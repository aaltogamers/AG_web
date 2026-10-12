import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import moment from 'moment'
import type { AGEvent } from '../../types/types'
import {
  createPost,
  deletePost,
  fetchDiscordRoles,
  fetchPost,
  fetchSettings,
  postAction,
  previewPost,
  savePost,
  sendTestPost,
  type DiscordRoleOption,
  type PostAction,
} from '../../utils/social/postsClient'
import {
  PLATFORM_LABELS,
  POST_STATUS_LABELS,
  type Channel,
  type Platform,
  type Post,
  type PostHistoryEntry,
  type PostPreview,
} from '../../utils/social/types'
import DiscordPingsPicker from './DiscordPingsPicker'
import EventPicker from './EventPicker'
import ImagePicker from './ImagePicker'
import MarkdownEditor from './MarkdownEditor'
import PostPreviewPanel from './PostPreviewPanel'
import PostTimePicker from './PostTimePicker'
import TargetOverrideChips from './TargetOverrideChips'
import {
  draftToInput,
  duplicateDraft,
  emptyEventDraft,
  emptyPostDraft,
  eventToDraft,
  postEventStart,
  postToDraft,
  readStoredDraft,
  restoreDraft,
  storeDraft,
  type EventField,
  type PostDraft,
  type TargetDraft,
} from './postDraft'
import WebsiteChangeEditor from './WebsiteChangeEditor'
import { useToast } from '../Toast'

type Props = {
  // null for a new post
  postId: string | null
  events: AGEvent[]
  // A new post was saved
  onSaved: (postId: string) => void
  onClose: () => void
  // The send time of a new post, e.g. the day clicked in the calendar
  initialSendAt?: string
}

const inputClass = 'p-2 rounded-md bg-white text-black w-full border border-gray-300'

const actorLabel = (actor: string) =>
  actor === 'admin'
    ? 'on website'
    : actor === 'agent'
      ? 'by AI agent'
      : actor.startsWith('tg:')
        ? `by Telegram ${actor.slice(3)}`
        : `by ${actor}`

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
const RESTORE_CONFIRM = 'Replace your unsaved changes with this version?'
const DELETE_CONFIRM =
  'Delete this post? Unsent messages and website changes are not sent, and the post and its history are gone for good.'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h3 className="text-xl font-normal">{title}</h3>
    {children}
  </section>
)

const PostEditor = ({
  postId,
  events,
  onSaved,
  onClose,
  initialSendAt = '',
}: Props) => {
  const [post, setPost] = useState<Post | null>(null)
  const [history, setHistory] = useState<PostHistoryEntry[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  // For Discord pings; null while loading
  const [discordRoles, setDiscordRoles] = useState<DiscordRoleOption[] | null>(null)
  const [leadMinutes, setLeadMinutes] = useState(10)
  const [testPlatforms, setTestPlatforms] = useState<Platform[]>([])
  const [draft, setDraft] = useState<PostDraft>(() => ({ ...emptyPostDraft(), sendAt: initialSendAt }))
  const [savedDraft, setSavedDraft] = useState<string>(() => JSON.stringify(draft))
  // Unsaved changes kept in the browser that were made on an older version of the post
  const [olderChanges, setOlderChanges] = useState<ReturnType<typeof readStoredDraft>>(null)
  // Whether the changes kept in the browser have been looked at
  const storageChecked = useRef(false)
  const [preview, setPreview] = useState<PostPreview | null>(null)
  // The saved post's preview, shown again when the changes are undone
  const [savedPreview, setSavedPreview] = useState<PostPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const toast = useToast()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newTime, setNewTime] = useState('')

  const load = useCallback(async () => {
    const settingsRes = await fetchSettings()
    setChannels(settingsRes.channels)
    setLeadMinutes(settingsRes.settings.website.leadMinutes)
    setTestPlatforms([
      ...(settingsRes.settings.telegram.testChatId ? (['telegram'] as const) : []),
      ...(settingsRes.settings.discord.testChannelId ? (['discord'] as const) : []),
    ])
    if (
      settingsRes.configured.discord &&
      settingsRes.channels.some((c) => c.platform === 'discord')
    ) {
      fetchDiscordRoles()
        .then((res) => setDiscordRoles(res.roles))
        .catch(() => setDiscordRoles([]))
    }
    const res = postId ? await fetchPost(postId) : null
    if (res) {
      const loaded = postToDraft(res.post, events)
      setPost(res.post)
      setHistory(res.history)
      setPreview(res.preview)
      setSavedPreview(res.preview)
      setDraft(loaded)
      setSavedDraft(JSON.stringify(loaded))
    }
    if (storageChecked.current) return
    storageChecked.current = true
    const stored = readStoredDraft(postId)
    if (!stored) return
    if (stored.version === (res?.post.version ?? null)) {
      setDraft(stored.draft)
      toast(`Restored your unsaved changes from ${moment(stored.savedAt).format('D.M. HH:mm')}.`)
    } else {
      setOlderChanges(stored)
    }
  }, [postId, events, toast])

  useEffect(() => {
    load().catch((e) => {
      setLoadError(e.message)
      toast(e.message, { isError: true })
    })
  }, [load, toast])

  const isDirty = JSON.stringify(draft) !== savedDraft

  // Keeps the unsaved changes in the browser, and asks before the page is closed
  useEffect(() => {
    if (!storageChecked.current || (olderChanges && !isDirty)) return
    storeDraft(postId, isDirty ? draft : null, post?.version ?? null)
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft, isDirty, olderChanges, postId, post?.version])

  // Live preview of the unsaved post
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const previewedEvent = useRef(draft.eventSlug)
  useEffect(() => {
    // A new event changes the editor's placeholder buttons, so update them right away
    const eventChanged = draft.eventSlug !== previewedEvent.current
    previewedEvent.current = draft.eventSlug
    if (!isDirty) {
      setPreview(savedPreview)
      setPreviewLoading(false)
      return
    }
    // A preview of an older draft that comes back late isn't shown
    let stale = false
    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const result = await previewPost(postId, draftToInput(draft))
        if (!stale) setPreview(result.preview)
      } catch (e) {
        if (stale) return
        setPreview((current) => ({
          texts: [],
          website: null,
          errors: [e instanceof Error ? e.message : String(e)],
          // Keep the editor's buttons as they were
          placeholders: current?.placeholders ?? { event: true, signupSessions: [] },
        }))
      } finally {
        if (!stale) setPreviewLoading(false)
      }
    }, eventChanged ? 0 : 700)
    return () => {
      stale = true
      clearTimeout(previewTimer.current)
    }
  }, [draft, isDirty, postId, savedPreview])

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
      ? { kind: 'update_event' as const, eventSlug, event, changed }
      : { kind: 'create_event' as const, eventSlug: '', event, changed: [] }
  }
  const setEvent = (eventSlug: string) =>
    set({
      eventSlug,
      websiteChange: draft.websiteChange && {
        ...draft.websiteChange,
        ...websiteChangeFor(eventSlug),
      },
    })
  const setTarget = (channelId: string, changes: Partial<TargetDraft>) =>
    set({
      targets: draft.targets.map((t) => (t.channelId === channelId ? { ...t, ...changes } : t)),
    })

  const run = async (work: () => Promise<{ post: Post; note?: string } | void>, done: string) => {
    setBusy(true)
    try {
      const result = await work()
      if (!postId) return
      if (result?.post) await load()
      toast(result?.note ? `${done} ${result.note}` : done)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), { isError: true })
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
        storeDraft(null, null, null)
        toast('Saved.')
        onSaved(created.id)
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
    postId &&
    post &&
    run(() => postAction(postId, action, { version: post.version, ...body }), done)

  // Saves a copy of the saved post as a new draft and opens it
  const duplicate = async () => {
    if (!post) return
    setBusy(true)
    try {
      const copy = duplicateDraft(post, events)
      // Disabled channels can't be used for new posts
      copy.targets = copy.targets.filter((t) =>
        channels.some((c) => c.id === t.channelId && c.enabled)
      )
      const { post: created } = await createPost(draftToInput(copy))
      toast('This is a copy of the post. Choose its send times and edit its text.')
      onSaved(created.id)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), { isError: true })
      setBusy(false)
    }
  }

  const discard = () => setDraft(JSON.parse(savedDraft))

  // Puts an earlier version in the editor; it's kept when it is saved
  const restore = (h: PostHistoryEntry) => {
    if (!h.snapshot || (isDirty && !window.confirm(RESTORE_CONFIRM))) return
    setDraft(restoreDraft(draft, h.snapshot, events))
    toast(`Version ${h.version} is in the editor. Save it to keep it, or discard the changes.`)
  }

  const remove = async () => {
    if (!postId || !window.confirm(DELETE_CONFIRM)) return
    setBusy(true)
    try {
      await deletePost(postId)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), { isError: true })
      setBusy(false)
    }
  }

  const status = post?.status ?? 'draft'
  const unschedulesOnSave = status === 'scheduled'
  const editable = status !== 'cancelled'
  const eventStart = useMemo(() => postEventStart(draft, events), [draft, events])
  const hasHeld =
    post?.targets.some((t) => t.status === 'held') || post?.websiteChange?.status === 'failed'
  const errorCount =
    (preview?.errors.length ?? 0) +
    (preview?.texts.reduce((n, t) => n + t.errors.length, 0) ?? 0) +
    (preview?.website?.errors.length ?? 0)

  const availableChannels = channels.filter(
    (c) => (c.enabled && !c.deleted) || draft.targets.some((t) => t.channelId === c.id)
  )

  if (postId && !post) {
    return <div className="text-center">{loadError ? <span className="text-red">{loadError}</span> : 'Loading…'}</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="borderbutton" onClick={onClose}>
          ← All posts
        </button>
        {post && (
          <span className="border border-lightgray rounded-md px-2 py-1 text-sm">
            {POST_STATUS_LABELS[status]}
            {post.approvedVersion === post.version && status === 'scheduled' && ' · approved'}
          </span>
        )}
      </div>
      {olderChanges && (
        <div className="flex flex-wrap items-center gap-3 border-2 border-yellow-400 rounded-md p-3 text-base">
          <span>
            You have unsaved changes from{' '}
            {moment(olderChanges.savedAt).format('D.M. HH:mm')}, but the post has been saved since.
          </span>
          <button
            type="button"
            className="borderbutton"
            onClick={() => {
              setDraft(olderChanges.draft)
              setOlderChanges(null)
            }}
          >
            Restore them
          </button>
          <button
            type="button"
            className="borderbutton"
            onClick={() => {
              storeDraft(postId, null, null)
              setOlderChanges(null)
            }}
          >
            Discard them
          </button>
        </div>
      )}

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
            <EventPicker
              events={events}
              value={draft.eventSlug}
              onChange={setEvent}
              noEventLabel={draft.websiteChange ? 'No event: the website change creates one' : 'No event'}
              disabled={!editable || !!draft.websiteChange?.locked}
            />
            <MarkdownEditor
              value={draft.bodyMd}
              onChange={(bodyMd) => set({ bodyMd })}
              rows={10}
              placeholder="The post's text"
              placeholders={preview?.placeholders}
              disabled={!editable}
            />
          </Section>

          <Section title="Images">
            {editable ? (
              <ImagePicker
                value={draft.images}
                onChange={(images) => set({ images })}
                events={events}
              />
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
                Send immediately when approved
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
                <div
                  key={channel.id}
                  className="border border-lightgray/40 rounded-md p-3 flex flex-col gap-2"
                >
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
                        {channel.config.manual && targetStatus.status === 'sent'
                          ? targetStatus.forwardedAt
                            ? `✅ forwarded by ${targetStatus.forwardedBy}`
                            : '📨 in the review topic, waiting to be forwarded'
                          : TARGET_STATUS_LABELS[targetStatus.status]}
                        {targetStatus.error && (
                          <span className="text-red"> {targetStatus.error}</span>
                        )}
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
                      <TargetOverrideChips
                        target={target}
                        channel={channel}
                        onChange={(changes) => setTarget(channel.id, changes)}
                        postSendAt={draft.sendAt}
                        postBodyMd={draft.bodyMd}
                        sendOnApproval={draft.sendOnApproval}
                        eventStart={eventStart}
                        placeholders={preview?.placeholders}
                      />
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
                  leadMinutes={leadMinutes}
                  eventStart={eventStart}
                />
                {!draft.websiteChange.locked && editable && (
                  <button
                    type="button"
                    className="borderbutton self-start"
                    onClick={() => set({ websiteChange: null })}
                  >
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
                  Create a new event or change an existing one before the messages go out.
                </div>
                {editable && (
                  <button
                    type="button"
                    className="borderbutton self-start"
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
            <Section title="Approval">
              {isDirty && unschedulesOnSave && (
                <div className="border-2 border-yellow-400 rounded-md p-3 text-base">
                  <div className="font-bold text-yellow-400">
                    ⚠️ This post is approved and scheduled
                  </div>
                  Saving your changes takes it off the schedule: nothing more is sent until it is
                  approved again.
                </div>
              )}
              {isDirty && editable && !unschedulesOnSave && status !== 'done' && (
                <div className="text-sm text-lightgray">Save the changes to approve the post.</div>
              )}
              <div className="flex flex-wrap gap-2">
                {editable && isDirty && (
                  <>
                    <button
                      type="button"
                      className="mainbutton"
                      disabled={busy}
                      onClick={() =>
                        (!unschedulesOnSave || window.confirm(UNSCHEDULE_CONFIRM)) && save()
                      }
                    >
                      Save as draft
                    </button>
                    <button type="button" className="borderbutton" disabled={busy} onClick={discard}>
                      Discard changes
                    </button>
                  </>
                )}
                {postId && !isDirty && (status === 'draft' || status === 'awaiting_approval') && (
                  <button
                    type="button"
                    className="mainbutton"
                    disabled={busy || errorCount > 0}
                    title={errorCount ? 'Fix the problems in the preview first' : undefined}
                    onClick={() =>
                      act(
                        'approve',
                        draft.sendOnApproval
                          ? 'Approved. It will be sent now.'
                          : 'Approved. It will be sent at the planned times.'
                      )
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
                {postId &&
                  !isDirty &&
                  (status === 'scheduled' || status === 'awaiting_approval') && (
                    <button
                      type="button"
                      className="borderbutton"
                      disabled={busy}
                      title="Takes it off the schedule, so nothing more is sent until it is approved again"
                      onClick={() =>
                        act(
                          'unschedule',
                          'Back to draft; nothing more is sent until it is approved again.'
                        )
                      }
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
                  <button
                    type="button"
                    className="borderbutton hover:!text-red"
                    disabled={busy}
                    onClick={remove}
                  >
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
                      onClick={() =>
                        act('retry', 'Retrying the website change.', {
                          newTime: newTime ? new Date(newTime).toISOString() : null,
                        })
                      }
                    >
                      🔁 Retry
                    </button>
                    <button
                      type="button"
                      className="borderbutton"
                      disabled={busy}
                      onClick={() =>
                        act(
                          'send-anyway',
                          'The messages will be sent without the website change.',
                          {
                            newTime: newTime ? new Date(newTime).toISOString() : null,
                          }
                        )
                      }
                    >
                      ▶️ Send anyway
                    </button>
                  </div>
                </div>
              )}
              {errorCount > 0 && (
                <div className="text-red text-sm">
                  Fix the problems in the preview before approving.
                </div>
              )}
            </Section>

            <Section title="Preview">
              <PostPreviewPanel
                preview={preview}
                loading={previewLoading}
                testPlatforms={testPlatforms}
                onTestSend={async (channelId) => {
                  try {
                    await sendTestPost(postId, draftToInput(draft), channelId)
                    toast('Posted on the test channel.')
                  } catch (e) {
                    toast(e instanceof Error ? e.message : String(e), { isError: true })
                  }
                }}
              />
            </Section>

            {history.length > 0 && (
              <Section title="History">
                <ul className="text-sm flex flex-col gap-1">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center gap-3 min-h-8">
                      <span>
                        {moment(h.createdAt).format('D.M. HH:mm')} · v{h.version} {h.action} {actorLabel(h.actor)}
                      </span>
                      {h.snapshot && editable && (h.version !== post?.version || isDirty) && (
                        <button
                          type="button"
                          className="borderbutton ml-auto"
                          disabled={busy}
                          onClick={() => restore(h)}
                        >
                          {h.version === post?.version ? 'Back to this' : 'Restore'}
                        </button>
                      )}
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
