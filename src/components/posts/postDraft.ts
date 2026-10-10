// The post editor's state and its PostInput. Times are in the browser's time,
// except session times, which are Helsinki times like in the CMS.
import moment from 'moment'
import type { AGEvent, SignupMode } from '../../types/types'
import type {
  EventChange,
  ImageChoice,
  Post,
  PostImage,
  PostInput,
  WebsiteChangeKind,
} from '../../utils/social/types'
import { draftToForm, formToDraft, type FormDraft } from '../SignupFormEditor'

const LOCAL = 'YYYY-MM-DDTHH:mm'

export const toLocal = (iso: string | null | undefined) => (iso ? moment(iso).format(LOCAL) : '')
export const fromLocal = (local: string) => (local ? new Date(local).toISOString() : null)

// Same format as the CMS gives sessions (randomSessionId in eventFiles.ts)
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

export type FormSlotDraft = { sessionId?: string; draft: FormDraft }

export type WebsiteChangeDraft = {
  kind: WebsiteChangeKind
  eventSlug: string
  ownTime: boolean
  runAt: string
  event: EventDraft
  changed: EventField[]
  forms: FormSlotDraft[]
  locked: boolean
}

export type PostDraft = {
  title: string
  bodyMd: string
  eventSlug: string
  sendAt: string
  images: PostImage[]
  targets: TargetDraft[]
  websiteChange: WebsiteChangeDraft | null
}

export const emptyPostDraft = (): PostDraft => ({
  title: '',
  bodyMd: '',
  eventSlug: '',
  sendAt: '',
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
      ownTime: !!change.runAt,
      runAt: toLocal(change.runAt),
      event,
      changed: (Object.keys(e) as EventField[]).filter((k) => e[k] !== undefined),
      forms: change.signupForms.map(({ sessionId, form }) => ({ sessionId, draft: formToDraft(form) })),
      locked: ['sending', 'done', 'skipped'].includes(change.status),
    }
  }
  return {
    title: post.title,
    bodyMd: post.bodyMd,
    eventSlug: post.eventSlug ?? '',
    sendAt: toLocal(post.sendAt),
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
        locked: t.status === 'sent' || t.status === 'sending',
      })),
    websiteChange,
  }
}

const textChoice = (t: TextDraft) => (t.fromPost ? { fromPost: true as const } : { text: t.text })

const eventToChange = (draft: WebsiteChangeDraft): EventChange => {
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
  if (draft.kind === 'create_event') {
    const { image, ...rest } = all
    return image ? all : rest
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

// Throws with a message if a sign-up form is incomplete; `lenient` leaves such forms
// out instead, for the live preview
export const draftToInput = (draft: PostDraft, { lenient = false } = {}): PostInput => {
  const change = draft.websiteChange
  return {
    title: draft.title,
    bodyMd: draft.bodyMd,
    eventSlug: postEventSlug(draft),
    sendAt: fromLocal(draft.sendAt),
    images: draft.images,
    targets: draft.targets.map((t) => ({
      channelId: t.channelId,
      sendAt: t.ownTime ? fromLocal(t.sendAt) : null,
      bodyOverrideMd: t.detached ? t.bodyOverrideMd : null,
      footerOverrideMd: t.footerOverride ? t.footerOverrideMd : null,
    })),
    websiteChange: change && {
      kind: change.kind,
      eventSlug: change.kind === 'update_event' ? change.eventSlug || null : null,
      runAt: change.ownTime ? fromLocal(change.runAt) : null,
      event: eventToChange(change),
      signupForms: change.forms.flatMap(({ sessionId, draft: formDraft }) => {
        const result = draftToForm(formDraft)
        if ('error' in result) {
          if (lenient) return []
          throw new Error(`Sign-up form: ${result.error}`)
        }
        return [{ ...(sessionId && { sessionId }), form: result.form }]
      }),
    },
  }
}
