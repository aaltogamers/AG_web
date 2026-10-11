import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import moment from 'moment'
import { FaRegClock } from 'react-icons/fa'
import type { AGEvent } from '../../types/types'
import { eventMoment } from '../../utils/eventUtils'
import {
  createPost,
  deletePost,
  fetchDiscordRoles,
  fetchPost,
  fetchSettings,
  postAction,
  previewPost,
  savePost,
  type DiscordRoleOption,
  type PostAction,
} from '../../utils/social/postsClient'
import {
  PLATFORM_LABELS,
  POST_STATUS_LABELS,
  type Channel,
  type Post,
  type PostHistoryEntry,
  type PostPreview,
} from '../../utils/social/types'
import DiscordPingsPicker from './DiscordPingsPicker'
import ImagePicker from './ImagePicker'
import MarkdownEditor from './MarkdownEditor'
import PostPreviewPanel from './PostPreviewPanel'
import PostTimePicker from './PostTimePicker'
import {
  draftToInput,
  duplicateDraft,
  emptyEventDraft,
  emptyPostDraft,
  eventToDraft,
  postEventStart,
  postToDraft,
  type EventField,
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
  // The send time of a new post, e.g. the day clicked in the calendar
  initialSendAt?: string
}

const inputClass = 'p-2 rounded-md bg-white text-black w-full border border-gray-300'

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
const DELETE_CONFIRM =
  'Delete this post? Unsent messages and website changes are not sent, and the post and its history are gone for good.'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h3 className="text-2xl">{title}</h3>
    {children}
  </section>
)

const PostEditor = ({ postId, events, onSaved, onClose, initialMessage = null, initialSendAt = '' }: Props) => {
  const [post, setPost] = useState<Post | null>(null)
  const [history, setHistory] = useState<PostHistoryEntry[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  // For Discord pings; null while loading
  const [discordRoles, setDiscordRoles] = useState<DiscordRoleOption[] | null>(null)
  const [leadMinutes, setLeadMinutes] = useState(10)
  const [draft, setDraft] = useState<PostDraft>({ ...emptyPostDraft(), sendAt: initialSendAt })
  const [savedDraft, setSavedDraft] = useState<string>(JSON.stringify(emptyPostDraft()))
  const [preview, setPreview] = useState<PostPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(initialMessage)
  const [busy, setBusy] = useState(false)
  const [newTime, setNewTime] = useState('')

  const load = useCallback(async () => {
    const settingsRes = await fetchSettings()
    setChannels(settingsRes.channels)
    setLeadMinutes(settingsRes.settings.website.leadMinutes)
    if (settingsRes.configured.discord && settingsRes.channels.some((c) => c.platform === 'discord')) {
      fetchDiscordRoles()
        .then((res) => setDiscordRoles(res.roles))
        .catch(() => setDiscordRoles([]))
    }
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
  // The website change changes the post's event, or creates a new one if it has none
  // An empty short description defaults to the post's text
  const websiteChangeFor = (eventSlug: string) => {
    const existing = events.find((e) => e.slug === eventSlug)
    const event = existing ? eventToDraft(existing) : emptyEventDraft()
    const changed: EventField[] = []
    if (!event.description.text.trim()) {
      event.description = { fromPost: true, text: '' }
      changed.push('description')
    }
    return existing
      ? { kind: 'update_event' as const, eventSlug, event, changed, forms: [] }
      : { kind: 'create_event' as const, eventSlug: '', event, changed: [], forms: [] }
  }
  const setEvent = (eventSlug: string) =>
    set({
      eventSlug,
      websiteChange: draft.websiteChange && { ...draft.websiteChange, ...websiteChangeFor(eventSlug) },
    })
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

  const save = () =>
    run(async () => {
      const input = draftToInput(draft)
      if (!postId) {
        const { post: created } = await createPost(input)
        onSaved(created.id, { text: 'Saved.' })
        return
      }
      if (!post) throw new Error('The post has not loaded yet')
      // A failed save keeps the unsaved changes on screen (nothing was saved)
      try {
        return await savePost(postId, post.version, input)
      } catch (e) {
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { keepDraft: true })
      }
    }, 'Saved.')

  const act = (action: PostAction, done: string, body: { newTime?: string | null } = {}) =>
    postId && post && run(() => postAction(postId, action, { version: post.version, ...body }), done)

  // Saves a copy of the saved post as a new draft and opens it
  const duplicate = async () => {
    if (!post) return
    setBusy(true)
    setMessage(null)
    try {
      const copy = duplicateDraft(post, events)
      // Disabled channels can't be used for new posts
      copy.targets = copy.targets.filter((t) => channels.some((c) => c.id === t.channelId && c.enabled))
      const { post: created } = await createPost(draftToInput(copy))
      onSaved(created.id, { text: 'This is a copy of the post. Choose its send times and edit its text.' })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), isError: true })
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!postId || !window.confirm(DELETE_CONFIRM)) return
    setBusy(true)
    setMessage(null)
    try {
      await deletePost(postId)
      onClose()
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), isError: true })
      setBusy(false)
    }
  }

  const status = post?.status ?? 'draft'
  const unschedulesOnSave = status === 'scheduled'
  const editable = status !== 'cancelled'
  const eventStart = useMemo(() => postEventStart(draft, events), [draft, events])
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
        {post && (
          <span className="border border-lightgray rounded-md px-2 py-1 text-sm">
            {POST_STATUS_LABELS[status]}
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
            <select
              value={draft.eventSlug}
              onChange={(e) => setEvent(e.target.value)}
              className={inputClass}
              disabled={!editable || !!draft.websiteChange?.locked}
            >
              <option value="">
                {draft.websiteChange ? 'No event: the website change creates a new one' : 'No event'}
              </option>
              {sortedEvents.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.name}
                  {e.sessions[0] ? ` (${eventMoment(e.sessions[0].start).format('D.M.YYYY')})` : ''}
                </option>
              ))}
            </select>
            <MarkdownEditor
              value={draft.bodyMd}
              onChange={(bodyMd) => set({ bodyMd })}
              rows={10}
              placeholder="The post's text"
              disabled={!editable}
            />
            <div className="text-sm text-lightgray">
              Links: <code>[AG Discord]({'{{link:discord}}'})</code>, <code>[Sign up]({'{{signup}}'})</code>,{' '}
              <code>[Example](https://example.com)</code>
              <br />
              Event: <code>{'{{date}}'}</code> (e.g. Friday, September 18th, or today / tomorrow),{' '}
              <code>{'{{time}}'}</code>, <code>{'{{location}}'}</code>, <code>{'{{signupOpens}}'}</code> (e.g. today at
              16:00). Of the next session at the send time, or <code>{'{{date:<session name>}}'}</code>.
            </div>
          </Section>

          <Section title="Images">
            {editable ? (
              <ImagePicker value={draft.images} onChange={(images) => set({ images })} events={events} />
            ) : (
              <div>{draft.images.length} image(s)</div>
            )}
          </Section>

          <Section title="Channels and times">
            <div className="flex flex-col gap-1">
              Send time of all channels
              <label className="flex items-center gap-2 text-base">
                <input
                  type="checkbox"
                  checked={draft.sendOnApproval}
                  onChange={(e) => set({ sendOnApproval: e.target.checked })}
                  disabled={!editable}
                />
                Send when approved
              </label>
              {!draft.sendOnApproval && (
                <PostTimePicker
                  value={draft.sendAt}
                  onChange={(sendAt) => set({ sendAt })}
                  eventStart={eventStart}
                  clearable
                  disabled={!editable}
                />
              )}
            </div>
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
                                  pings: channel.platform === 'discord' ? ['here'] : [],
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
                      {channel.platform === 'discord' && (
                        <div className="flex flex-col gap-1">
                          Pings
                          <DiscordPingsPicker
                            value={target.pings}
                            onChange={(pings) => setTarget(channel.id, { pings })}
                            roles={discordRoles}
                          />
                        </div>
                      )}
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
                        <PostTimePicker
                          value={target.sendAt}
                          onChange={(sendAt) => setTarget(channel.id, { sendAt })}
                          eventStart={eventStart}
                          extraPresets={
                            draft.sendAt && !draft.sendOnApproval
                              ? [-60, 60].map((minutes) => ({
                                  label: `1 hour ${minutes < 0 ? 'before' : 'after'} the post's time`,
                                  icon: <FaRegClock />,
                                  time: moment(draft.sendAt).add(minutes, 'minutes'),
                                }))
                              : []
                          }
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
                        <MarkdownEditor
                          value={target.bodyOverrideMd}
                          onChange={(bodyOverrideMd) => setTarget(channel.id, { bodyOverrideMd })}
                          rows={6}
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
                        <MarkdownEditor
                          value={target.footerOverrideMd}
                          onChange={(footerOverrideMd) => setTarget(channel.id, { footerOverrideMd })}
                          rows={2}
                          placeholder="Empty for no footer"
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
                  preview={preview?.website ?? null}
                  leadMinutes={leadMinutes}
                  eventStart={eventStart}
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
                          ...websiteChangeFor(draft.eventSlug),
                          timing: 'on_approval',
                          runAt: '',
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
                  again.
                </div>
              )}
              {isDirty && editable && status !== 'done' && (
                <div className="text-sm text-lightgray">Save the changes to approve the post.</div>
              )}
              <div className="flex flex-wrap gap-3 text-base">
                {editable && isDirty && (
                  <button type="button" className="borderbutton" disabled={busy} onClick={() => (!unschedulesOnSave || window.confirm(UNSCHEDULE_CONFIRM)) && save()}>
                    Save as draft
                  </button>
                )}
                {postId && !isDirty && (status === 'draft' || status === 'awaiting_approval') && (
                  <button
                    type="button"
                    className="mainbutton"
                    disabled={busy || errorCount > 0}
                    title={errorCount ? 'Fix the problems in the preview first' : undefined}
                    onClick={() =>
                      act('approve', draft.sendOnApproval ? 'Approved. It will be sent now.' : 'Approved. It will be sent at the planned times.')
                    }
                  >
                    Approve
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
                {postId && !isDirty && (status === 'scheduled' || status === 'awaiting_approval') && (
                  <button
                    type="button"
                    className="borderbutton"
                    disabled={busy}
                    title="Takes it off the schedule, so nothing more is sent until it is approved again"
                    onClick={() => act('unschedule', 'Back to draft; nothing more is sent until it is approved again.')}
                  >
                    Back to draft
                  </button>
                )}
                {post && (
                  <button
                    type="button"
                    className="borderbutton"
                    disabled={busy}
                    title="Saves a copy of the saved version as a new draft, without times or a website change, e.g. for a reminder"
                    onClick={duplicate}
                  >
                    Duplicate
                  </button>
                )}
                {postId && (
                  <button type="button" className="borderbutton hover:!text-red" disabled={busy} onClick={remove}>
                    Delete post
                  </button>
                )}
              </div>
              {hasHeld && status === 'scheduled' && !isDirty && (
                <div className="flex flex-col gap-2 text-base border border-red rounded-md p-3">
                  <div className="text-red">
                    The website change failed, so the messages are held back.
                    {post?.websiteChange?.error && ` ${post.websiteChange.error}`}
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    New send time for messages whose time has passed (empty: now)
                    <PostTimePicker
                      value={newTime}
                      onChange={setNewTime}
                      eventStart={eventStart}
                      clearable
                      placeholder="Now"
                    />
                  </div>
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
                      {moment(h.createdAt).format('D.M. HH:mm')} · {h.action} by {actorLabel(h.actor)}
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
