// The post editor's state and its PostInput. Times are in the browser's time,
// except session times, which are Helsinki times like in events.
import moment from 'moment'
import { eventMoment } from '../../utils/eventUtils'
import type { AGEvent, SignupMode } from '../../types/types'
import type {
  EventChange,
  ImageChoice,
  Post,
  PostImage,
  PostInput,
  WebsiteChangeKind,
  WebsiteChangeTiming,
} from '../../utils/social/types'

const LOCAL = 'YYYY-MM-DDTHH:mm'

export const toLocal = (iso: string | null | undefined) => (iso ? moment(iso).format(LOCAL) : '')
export const fromLocal = (local: string) => (local ? new Date(local).toISOString() : null)

// Same format as eventStore gives sessions (randomSessionId in eventStore.ts)
export const randomSessionId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('')

export type TargetDraft = {
  channelId: string
  ownTime: boolean
  sendAt: string
  detached: boolean
  bodyOverrideMd: string
  footerOverride: boolean
  footerOverrideMd: string
  // Discord: 'here', 'everyone' or role ids
  pings: string[]
  // Sent or being sent: shown, but not editable
  locked: boolean
}

export type SessionDraft = {
  id: string
  name: string
  // Helsinki wall-clock, YYYY-MM-DDTHH:mm
  start: string
  end: string
  location: string
}

export type TextDraft = { fromPost: boolean; text: string }

// The fields of a new event, or of an existing event to change. In an update,
// only the fields in `changed` are changed.
export type EventDraft = {
  name: string
  sessions: SessionDraft[]
  signupMode: SignupMode
  image: ImageChoice | null
  visibleOnCalendar: boolean
  visibleOnEventsPage: boolean
  description: TextDraft
  body: TextDraft
}

export type EventField = keyof EventDraft

export type WebsiteChangeDraft = {
  kind: WebsiteChangeKind
  eventSlug: string
  timing: WebsiteChangeTiming
  runAt: string
  event: EventDraft
  changed: EventField[]
  locked: boolean
}

export type PostDraft = {
  title: string
  bodyMd: string
  eventSlug: string
  sendAt: string
  sendOnApproval: boolean
  images: PostImage[]
  targets: TargetDraft[]
  websiteChange: WebsiteChangeDraft | null
}

export const emptyPostDraft = (): PostDraft => ({
  title: '',
  bodyMd: '',
  eventSlug: '',
  sendAt: '',
  sendOnApproval: false,
  images: [],
  targets: [],
  websiteChange: null,
})

export const emptyEventDraft = (): EventDraft => ({
  name: '',
  sessions: [],
  signupMode: 'none',
  image: null,
  visibleOnCalendar: true,
  visibleOnEventsPage: true,
  description: { fromPost: false, text: '' },
  body: { fromPost: false, text: '' },
})

const contentToLocal = (time: string) => time.slice(0, 16)

// An existing event's values, e.g. as the starting point of a change or a copy
export const eventToDraft = (event: AGEvent, withSessions = true): EventDraft => ({
  name: event.name,
  sessions: withSessions
    ? event.sessions.map((s) => ({
        id: s.id ?? randomSessionId(),
        name: s.name ?? '',
        start: contentToLocal(s.start),
        end: contentToLocal(s.end),
        location: s.location,
      }))
    : [],
  signupMode: event.signupMode,
  image: event.image ? { sitePath: event.image } : null,
  visibleOnCalendar: event.visibleOnCalendar,
  visibleOnEventsPage: event.visibleOnEventsPage,
  description: { fromPost: false, text: event.description },
  body: { fromPost: false, text: event.content.trim() },
})

export const postToDraft = (post: Post, events: AGEvent[]): PostDraft => {
  const change = post.websiteChange
  let websiteChange: WebsiteChangeDraft | null = null
  if (change) {
    const current = events.find((e) => e.slug === change.eventSlug)
    const event =
      change.kind === 'update_event' && current ? eventToDraft(current) : emptyEventDraft()
    const e = change.event
    if (e.name !== undefined) event.name = e.name
    if (e.sessions !== undefined) {
      event.sessions = e.sessions.map((s) => ({
        id: s.id,
        name: s.name ?? '',
        start: contentToLocal(s.start),
        end: contentToLocal(s.end),
        location: s.location,
      }))
    }
    if (e.signupMode !== undefined) event.signupMode = e.signupMode
    if (e.image !== undefined) event.image = e.image
    if (e.visibleOnCalendar !== undefined) event.visibleOnCalendar = e.visibleOnCalendar
    if (e.visibleOnEventsPage !== undefined) event.visibleOnEventsPage = e.visibleOnEventsPage
    if (e.description !== undefined) {
      event.description = 'fromPost' in e.description ? { fromPost: true, text: '' } : { fromPost: false, text: e.description.text }
    }
    if (e.body !== undefined) {
      event.body = 'fromPost' in e.body ? { fromPost: true, text: '' } : { fromPost: false, text: e.body.text }
    }
    websiteChange = {
      kind: change.kind,
      eventSlug: change.eventSlug ?? '',
      timing: change.timing,
      runAt: toLocal(change.runAt),
      event,
      changed: (Object.keys(e) as EventField[]).filter((k) => e[k] !== undefined),
      locked: ['sending', 'done', 'skipped'].includes(change.status),
    }
  }
  return {
    title: post.title,
    bodyMd: post.bodyMd,
    // A new event that isn't created yet isn't selectable; its slug is chosen again at approval
    eventSlug: websiteChange?.kind === 'create_event' && !websiteChange.locked ? '' : (post.eventSlug ?? ''),
    // A post sent on approval has the approval time once approved
    sendAt: post.sendOnApproval ? '' : toLocal(post.sendAt),
    sendOnApproval: post.sendOnApproval,
    images: post.images,
    targets: post.targets
      .filter((t) => t.status !== 'cancelled')
      .map((t) => ({
        channelId: t.channelId,
        ownTime: !!t.sendAt,
        sendAt: toLocal(t.sendAt),
        detached: t.bodyOverrideMd !== null,
        bodyOverrideMd: t.bodyOverrideMd ?? '',
        footerOverride: t.footerOverrideMd !== null,
        footerOverrideMd: t.footerOverrideMd ?? '',
        pings: t.pings,
        locked: t.status === 'sent' || t.status === 'sending',
      })),
    websiteChange,
  }
}

const textChoice = (t: TextDraft) => (t.fromPost ? { fromPost: true as const } : { text: t.text })

const eventToChange = (draft: WebsiteChangeDraft, images: PostImage[]): EventChange => {
  const e = draft.event
  const all: Required<EventChange> = {
    name: e.name,
    sessions: e.sessions.map((s) => ({
      id: s.id,
      ...(s.name.trim() && { name: s.name.trim() }),
      start: s.start,
      end: s.end || s.start,
      location: s.location,
    })),
    signupMode: e.signupMode,
    image: e.image,
    visibleOnCalendar: e.visibleOnCalendar,
    visibleOnEventsPage: e.visibleOnEventsPage,
    description: textChoice(e.description),
    body: textChoice(e.body),
  }
  // A new event has the post's first image (or none: the AG logo) and is shown everywhere
  if (draft.kind === 'create_event') {
    const created: EventChange = { ...all, visibleOnCalendar: true, visibleOnEventsPage: true }
    if (images.length) created.image = { postImage: 0 }
    else delete created.image
    return created
  }
  return Object.fromEntries(draft.changed.map((field) => [field, all[field]])) as EventChange
}

// The post's event: the website change's event, or the one picked in the editor.
// A new event's slug is chosen when the post is approved.
const postEventSlug = (draft: PostDraft) => {
  const change = draft.websiteChange
  if (!change || change.locked) return draft.eventSlug || null
  return change.kind === 'update_event' ? change.eventSlug || null : null
}

export const draftToInput = (draft: PostDraft): PostInput => {
  const change = draft.websiteChange
  return {
    title: draft.title,
    bodyMd: draft.bodyMd,
    eventSlug: postEventSlug(draft),
    sendAt: draft.sendOnApproval ? null : fromLocal(draft.sendAt),
    sendOnApproval: draft.sendOnApproval,
    images: draft.images,
    targets: draft.targets.map((t) => ({
      channelId: t.channelId,
      sendAt: t.ownTime ? fromLocal(t.sendAt) : null,
      bodyOverrideMd: t.detached ? t.bodyOverrideMd : null,
      footerOverrideMd: t.footerOverride ? t.footerOverrideMd : null,
      pings: t.pings,
    })),
    websiteChange: change && {
      kind: change.kind,
      eventSlug: change.kind === 'update_event' ? change.eventSlug || null : null,
      timing: change.timing,
      runAt: change.timing === 'at' ? fromLocal(change.runAt) : null,
      event: eventToChange(change, draft.images),
    },
  }
}

// A new draft with the post's text, event, images and channels, without times or a
// website change, e.g. for a reminder of the same event
export const duplicateDraft = (post: Post, events: AGEvent[]): PostDraft => {
  const draft = postToDraft(post, events)
  return {
    ...draft,
    title: `${draft.title || 'Untitled'} (copy)`,
    eventSlug: post.eventSlug && events.some((e) => e.slug === post.eventSlug) ? post.eventSlug : '',
    sendAt: '',
    sendOnApproval: false,
    targets: draft.targets.map((t) => ({ ...t, ownTime: false, sendAt: '', locked: false })),
    websiteChange: null,
  }
}

// When the post's event starts (in the browser's time), for the time pickers: its
// next session, or its first if all have passed. The website change's sessions
// when it sets them.
export const postEventStart = (draft: PostDraft, events: AGEvent[]): moment.Moment | null => {
  const change = draft.websiteChange
  const sessions =
    change && (change.kind === 'create_event' || change.changed.includes('sessions'))
      ? change.event.sessions.map((s) => s.start)
      : (events.find((e) => e.slug === (change?.eventSlug || draft.eventSlug))?.sessions.map((s) => s.start.slice(0, 16)) ?? [])
  const starts = sessions
    .filter(Boolean)
    .map((s) => eventMoment(s).local())
    .sort((a, b) => a.valueOf() - b.valueOf())
  return starts.find((s) => s.isAfter(moment())) ?? starts[0] ?? null
}

// An earlier version of the post in the editor. Messages and website changes that
// have already been sent stay as they are now.
export const restoreDraft = (current: PostDraft, snapshot: Post, events: AGEvent[]): PostDraft => {
  const restored = postToDraft(snapshot, events)
  const locked = current.targets.filter((t) => t.locked)
  const changeLocked = !!current.websiteChange?.locked
  return {
    ...restored,
    eventSlug: changeLocked ? current.eventSlug : restored.eventSlug,
    targets: [
      ...locked,
      ...restored.targets
        .filter((t) => !locked.some((l) => l.channelId === t.channelId))
        .map((t) => ({ ...t, locked: false })),
    ],
    websiteChange: changeLocked
      ? current.websiteChange
      : restored.websiteChange && { ...restored.websiteChange, locked: false },
  }
}

// Unsaved changes are kept in the browser, e.g. if the page is closed by accident
type StoredDraft = { draft: PostDraft; version: number | null; savedAt: string }

const storageKey = (postId: string | null) => `post-draft:${postId ?? 'new'}`

export const readStoredDraft = (postId: string | null): StoredDraft | null => {
  try {
    const stored = localStorage.getItem(storageKey(postId))
    return stored ? (JSON.parse(stored) as StoredDraft) : null
  } catch {
    return null
  }
}

export const storeDraft = (postId: string | null, draft: PostDraft | null, version: number | null) => {
  try {
    if (draft) {
      const stored: StoredDraft = { draft, version, savedAt: new Date().toISOString() }
      localStorage.setItem(storageKey(postId), JSON.stringify(stored))
    } else {
      localStorage.removeItem(storageKey(postId))
    }
  } catch {
    // E.g. a private window; the changes just aren't kept
  }
}
