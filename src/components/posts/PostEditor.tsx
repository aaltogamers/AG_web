import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import moment from 'moment'
import type { AGEvent } from '../../types/types'
import { eventMoment } from '../../utils/eventUtils'
import {
  createPost,
  fetchPost,
  fetchSettings,
  postAction,
  previewPost,
  savePost,
  type PostAction,
} from '../../utils/social/postsClient'
import { PLACEHOLDER_HELP } from '../../utils/social/render'
import {
  PLATFORM_LABELS,
  POST_STATUS_LABELS,
  type Channel,
  type Post,
  type PostHistoryEntry,
  type PostPreview,
} from '../../utils/social/types'
import ImagePicker from './ImagePicker'
import PostPreviewPanel from './PostPreviewPanel'
import {
  draftToInput,
  emptyEventDraft,
  emptyPostDraft,
  postToDraft,
  toLocal,
  type PostDraft,
  type TargetDraft,
} from './postDraft'
import WebsiteChangeEditor from './WebsiteChangeEditor'

type Message = { text: string; isError?: boolean }

type Props = {
  // null for a new post
  postId: string | null
  events: AGEvent[]
  // A new post was saved; `message` is shown in its editor
  onSaved: (postId: string, message: Message) => void
  onClose: () => void
  // E.g. the result of saving a new post
  initialMessage?: Message | null
}

const inputClass = 'p-2 rounded-md bg-white text-black w-full'

const actorLabel = (actor: string) =>
  actor === 'admin' ? 'admin' : actor === 'agent' ? 'AI agent' : actor.startsWith('tg:') ? `Telegram ${actor.slice(3)}` : actor

const TARGET_STATUS_LABELS: Record<string, string> = {
  pending: '',
  sending: 'sending…',
  sent: '✅ sent',
  held: '⏸ held back',
  failed: '❗ failed',
  cancelled: 'cancelled',
}

const UNSCHEDULE_CONFIRM =
  'This post is approved. Saving it as a draft takes it off the schedule, so nothing more is sent until it is approved again. Save anyway?'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h3 className="text-2xl">{title}</h3>
    {children}
  </section>
)

const PostEditor = ({ postId, events, onSaved, onClose, initialMessage = null }: Props) => {
  const [post, setPost] = useState<Post | null>(null)
  const [history, setHistory] = useState<PostHistoryEntry[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [leadMinutes, setLeadMinutes] = useState(10)
  const [draft, setDraft] = useState<PostDraft>(emptyPostDraft())
  const [savedDraft, setSavedDraft] = useState<string>(JSON.stringify(emptyPostDraft()))
  const [preview, setPreview] = useState<PostPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(initialMessage)
  const [busy, setBusy] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [newTime, setNewTime] = useState('')

  const load = useCallback(async () => {
    const settingsRes = await fetchSettings()
    setChannels(settingsRes.channels)
    setLeadMinutes(settingsRes.settings.website.leadMinutes)
    if (!postId) return
    const res = await fetchPost(postId)
    const loaded = postToDraft(res.post, events)
    setPost(res.post)
    setHistory(res.history)
    setPreview(res.preview)
    setDraft(loaded)
    setSavedDraft(JSON.stringify(loaded))
  }, [postId, events])

  useEffect(() => {
    load().catch((e) => setMessage({ text: e.message, isError: true }))
  }, [load])

  const isDirty = JSON.stringify(draft) !== savedDraft

  // Live preview of the unsaved post
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!isDirty) return
    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        setPreview((await previewPost(postId, draftToInput(draft, { lenient: true }))).preview)
      } catch (e) {
        setPreview({ texts: [], website: null, errors: [e instanceof Error ? e.message : String(e)] })
      } finally {
        setPreviewLoading(false)
      }
    }, 700)
    return () => clearTimeout(previewTimer.current)
  }, [draft, isDirty, postId])

  const set = (changes: Partial<PostDraft>) => setDraft((old) => ({ ...old, ...changes }))
  const setTarget = (channelId: string, changes: Partial<TargetDraft>) =>
    set({ targets: draft.targets.map((t) => (t.channelId === channelId ? { ...t, ...changes } : t)) })

  const run = async (work: () => Promise<{ post: Post; note?: string } | void>, done: string) => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await work()
      if (!postId) return
      if (result?.post) await load()
      setMessage({ text: result?.note ? `${done} ${result.note}` : done })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), isError: true })
      if (postId && !(e as { keepDraft?: boolean }).keepDraft) await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  const save = (approve = false) =>
    run(async () => {
      const input = draftToInput(draft)
      if (!postId) {
        const { post: created } = await createPost(input)
        // The post exists now, so open it even if approving fails; saving again would make a copy
        let saved: Message = { text: approve ? 'Saved and approved.' : 'Saved.' }
        if (approve) {
          try {
            await postAction(created.id, 'approve', { version: created.version })
          } catch (e) {
            saved = { text: `Saved as a draft, but not approved: ${e instanceof Error ? e.message : e}`, isError: true }
          }
        }
        onSaved(created.id, saved)
        return
      }
      if (!post) throw new Error('The post has not loaded yet')
      // A failed save keeps the unsaved changes on screen (nothing was saved)
      let saved: { post: Post; note?: string }
      try {
        saved = await savePost(postId, post.version, input)
      } catch (e) {
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { keepDraft: true })
      }
      if (!approve) return saved
      try {
        return { ...saved, post: await postAction(postId, 'approve', { version: saved.post.version }).then((r) => r.post) }
      } catch (e) {
        throw new Error(`Saved as a draft, but not approved: ${e instanceof Error ? e.message : e}`)
      }
    }, approve ? 'Saved and approved.' : 'Saved.')

  const act = (action: PostAction, done: string, body: { comment?: string; newTime?: string | null } = {}) =>
    postId && post && run(() => postAction(postId, action, { version: post.version, ...body }), done)

  const status = post?.status ?? 'draft'
  const unschedulesOnSave = status === 'scheduled'
  const editable = status !== 'cancelled'
  const hasHeld = post?.targets.some((t) => t.status === 'held') || post?.websiteChange?.status === 'failed'
  const errorCount =
    (preview?.errors.length ?? 0) +
    (preview?.texts.reduce((n, t) => n + t.errors.length, 0) ?? 0) +
    (preview?.website?.errors.length ?? 0)

  const availableChannels = channels.filter(
    (c) => (c.enabled && !c.deleted) || draft.targets.some((t) => t.channelId === c.id)
  )
  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          (b.sessions[0] ? eventMoment(b.sessions[0].start).valueOf() : 0) -
          (a.sessions[0] ? eventMoment(a.sessions[0].start).valueOf() : 0)
      ),
    [events]
  )

  if (postId && !post && !message) return <div className="text-center">Loading…</div>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="link" onClick={onClose}>
          ← All posts
        </button>
        <h2 className="text-3xl">{postId ? `Post #${postId}` : 'New post'}</h2>
        {post && (
          <span className="border border-lightgray rounded-md px-2 py-1 text-sm">
            {POST_STATUS_LABELS[status]} · v{post.version}
            {post.approvedVersion === post.version && status === 'scheduled' && ' · approved'}
          </span>
        )}
      </div>
      {message && <div className={message.isError ? 'text-red' : 'text-green-400'}>{message.text}</div>}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex flex-col gap-8 lg:w-1/2 min-w-0">
          <Section title="Text">
            <input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Title (only shown to admins)"
              className={inputClass}
              disabled={!editable}
            />
            {!draft.websiteChange && (
              <select
                value={draft.eventSlug}
                onChange={(e) => set({ eventSlug: e.target.value })}
                className={inputClass}
                disabled={!editable}
              >
                <option value="">No event (for {'{{event}}'} and {'{{signup}}'} links)</option>
                {sortedEvents.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name}
                    {e.sessions[0] ? ` (${eventMoment(e.sessions[0].start).format('D.M.YYYY')})` : ''}
                  </option>
                ))}
              </select>
            )}
            <textarea
              value={draft.bodyMd}
              onChange={(e) => set({ bodyMd: e.target.value })}
              rows={12}
              placeholder="Markdown: **bold**, _italic_, [links](https://…), lists…"
              className={`${inputClass} font-mono text-sm`}
              disabled={!editable}
            />
            <div className="text-sm text-lightgray">Placeholders: {PLACEHOLDER_HELP}</div>
          </Section>

          <Section title="Images">
            {editable ? (
              <ImagePicker value={draft.images} onChange={(images) => set({ images })} events={events} />
            ) : (
              <div>{draft.images.length} image(s)</div>
            )}
          </Section>

          <Section title="Channels and times">
            <label className="flex flex-col gap-1">
              Send time of all channels
              <input
                type="datetime-local"
                value={draft.sendAt}
                onChange={(e) => set({ sendAt: e.target.value })}
                className={inputClass}
                disabled={!editable}
              />
            </label>
            {availableChannels.length === 0 && (
              <div className="text-lightgray">
                No channels yet. Add them in the{' '}
                <Link href="/admin/posts/settings" className="link">
                  settings
                </Link>
                .
              </div>
            )}
            {availableChannels.map((channel) => {
              const target = draft.targets.find((t) => t.channelId === channel.id)
              const targetStatus = post?.targets.find((t) => t.channelId === channel.id)
              const locked = !!target?.locked || !editable
              return (
                <div key={channel.id} className="border border-lightgray/40 rounded-md p-3 flex flex-col gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!target}
                      disabled={locked}
                      onChange={(e) =>
                        set({
                          targets: e.target.checked
                            ? [
                                ...draft.targets,
                                {
                                  channelId: channel.id,
                                  ownTime: false,
                                  sendAt: '',
                                  detached: false,
                                  bodyOverrideMd: '',
                                  footerOverride: false,
                                  footerOverrideMd: '',
                                  locked: false,
                                },
                              ]
                            : draft.targets.filter((t) => t.channelId !== channel.id),
                        })
                      }
                    />
                    <span className="font-bold">
                      {PLATFORM_LABELS[channel.platform]}: {channel.name}
                    </span>
                    {!channel.enabled && <span className="text-sm text-lightgray">(disabled)</span>}
                    {targetStatus && (
                      <span className="text-sm">
                        {TARGET_STATUS_LABELS[targetStatus.status]}
                        {targetStatus.error && <span className="text-red"> {targetStatus.error}</span>}
                      </span>
                    )}
                  </label>
                  {target && !locked && (
                    <div className="flex flex-col gap-2 pl-6 text-base">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={target.ownTime}
                          onChange={(e) =>
                            setTarget(channel.id, { ownTime: e.target.checked, sendAt: target.sendAt || draft.sendAt })
                          }
                        />
                        Own send time
                      </label>
                      {target.ownTime && (
                        <input
                          type="datetime-local"
                          value={target.sendAt}
                          onChange={(e) => setTarget(channel.id, { sendAt: e.target.value })}
                          className={inputClass}
                        />
                      )}
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={target.detached}
                          onChange={(e) =>
                            setTarget(channel.id, {
                              detached: e.target.checked,
                              bodyOverrideMd: target.bodyOverrideMd || draft.bodyMd,
                            })
                          }
                        />
                        Own text for this channel
                      </label>
                      {target.detached && (
                        <textarea
                          value={target.bodyOverrideMd}
                          onChange={(e) => setTarget(channel.id, { bodyOverrideMd: e.target.value })}
                          rows={8}
                          className={`${inputClass} font-mono text-sm`}
                        />
                      )}
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={target.footerOverride}
                          onChange={(e) =>
                            setTarget(channel.id, {
                              footerOverride: e.target.checked,
                              footerOverrideMd: target.footerOverrideMd || channel.defaultFooterMd,
                            })
                          }
                        />
                        Own footer {!target.footerOverride && channel.defaultFooterMd && (
                          <span className="text-sm text-lightgray">(default: {channel.defaultFooterMd})</span>
                        )}
                      </label>
                      {target.footerOverride && (
                        <textarea
                          value={target.footerOverrideMd}
                          onChange={(e) => setTarget(channel.id, { footerOverrideMd: e.target.value })}
                          rows={2}
                          placeholder="Empty for no footer"
                          className={`${inputClass} font-mono text-sm`}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </Section>

          <Section title="Website change">
            {draft.websiteChange ? (
              <>
                <WebsiteChangeEditor
                  value={draft.websiteChange}
                  onChange={(websiteChange) => set({ websiteChange })}
                  events={events}
                  postImages={draft.images}
                  preview={preview?.website ?? null}
                  leadMinutes={leadMinutes}
                />
                {!draft.websiteChange.locked && editable && (
                  <button type="button" className="link self-start text-sm" onClick={() => set({ websiteChange: null })}>
                    Remove the website change
                  </button>
                )}
                {post?.websiteChange?.error && (
                  <div className="text-red text-sm">❗ {post.websiteChange.error}</div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="text-sm text-lightgray">
                  Create a new event or change an existing one (and its sign-up forms) before the messages go out.
                </div>
                {editable && (
                  <button
                    type="button"
                    className="borderbutton self-start text-base"
                    onClick={() =>
                      set({
                        websiteChange: {
                          kind: 'create_event',
                          eventSlug: '',
                          ownTime: false,
                          runAt: '',
                          event: emptyEventDraft(),
                          changed: [],
                          forms: [],
                          locked: false,
                        },
                      })
                    }
                  >
                    Add a website change
                  </button>
                )}
              </div>
            )}
          </Section>
        </div>

        <div className="lg:w-1/2 min-w-0 flex flex-col gap-8">
          <div className="lg:sticky lg:top-24 flex flex-col gap-8">
            <Section title="Preview">
              <PostPreviewPanel preview={preview} loading={previewLoading} />
            </Section>

            <Section title="Approval">
              {isDirty && unschedulesOnSave && (
                <div className="border-2 border-yellow-400 rounded-md p-3 text-base">
                  <div className="font-bold text-yellow-400">⚠️ This post is approved and scheduled</div>
                  Saving your changes takes it off the schedule: nothing more is sent until it is approved
                  again. Use &quot;Save and approve&quot; to keep it scheduled.
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-base">
                {editable && (
                  <button type="button" className="borderbutton" disabled={busy || (!isDirty && !!postId)} onClick={() => (!unschedulesOnSave || window.confirm(UNSCHEDULE_CONFIRM)) && save(false)}>
                    Save as draft
                  </button>
                )}
                {editable && status !== 'done' && (isDirty || status === 'draft' || status === 'awaiting_approval') && (
                  <button
                    type="button"
                    className="mainbutton"
                    disabled={busy || errorCount > 0}
                    title={errorCount ? 'Fix the problems in the preview first' : undefined}
                    onClick={() =>
                      isDirty || !postId ? save(true) : act('approve', 'Approved. It will be sent at the planned times.')
                    }
                  >
                    {isDirty || !postId ? 'Save and approve' : 'Approve'}
                  </button>
                )}
                {postId && status === 'draft' && !isDirty && (
                  <button
                    type="button"
                    className="borderbutton"
                    disabled={busy}
                    onClick={() => act('request-approval', 'Sent for approval.')}
                  >
                    Request approval in Telegram
                  </button>
                )}
                {postId && status !== 'cancelled' && status !== 'done' && (
                  <button
                    type="button"
                    className="borderbutton"
                    disabled={busy}
                    onClick={() => window.confirm('Cancel this post? Unsent messages and website changes are not sent.') && act('cancel', 'Cancelled.')}
                  >
                    Cancel post
                  </button>
                )}
              </div>
              {status === 'awaiting_approval' && !isDirty && (
                <div className="flex flex-col gap-2 text-base">
                  <textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    rows={2}
                    placeholder="Reason for rejecting (optional, shown to the author)"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    className="borderbutton self-start"
                    disabled={busy}
                    onClick={() => act('reject', 'Rejected; back to draft.', { comment: rejectComment })}
                  >
                    Reject
                  </button>
                </div>
              )}
              {hasHeld && status === 'scheduled' && !isDirty && (
                <div className="flex flex-col gap-2 text-base border border-red rounded-md p-3">
                  <div className="text-red">
                    The website change failed, so the messages are held back.
                    {post?.websiteChange?.error && ` ${post.websiteChange.error}`}
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    New send time for messages whose time has passed (empty: now)
                    <input
                      type="datetime-local"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      min={toLocal(new Date().toISOString())}
                      className={inputClass}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="mainbutton"
                      disabled={busy}
                      onClick={() => act('retry', 'Retrying the website change.', { newTime: newTime ? new Date(newTime).toISOString() : null })}
                    >
                      🔁 Retry
                    </button>
                    <button
                      type="button"
                      className="borderbutton"
                      disabled={busy}
                      onClick={() =>
                        act('send-anyway', 'The messages will be sent without the website change.', {
                          newTime: newTime ? new Date(newTime).toISOString() : null,
                        })
                      }
                    >
                      ▶️ Send anyway
                    </button>
                  </div>
                </div>
              )}
              {errorCount > 0 && <div className="text-red text-sm">Fix the problems in the preview before approving.</div>}
            </Section>

            {history.length > 0 && (
              <Section title="History">
                <ul className="text-sm flex flex-col gap-1">
                  {history.map((h, i) => (
                    <li key={i}>
                      {moment(h.createdAt).format('D.M. HH:mm')} · v{h.version} · {h.action} by {actorLabel(h.actor)}
                      {h.comment && <span className="text-yellow-400">: “{h.comment}”</span>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PostEditor
