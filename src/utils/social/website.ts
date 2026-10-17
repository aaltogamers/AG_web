// Website changes of posts: the event (eventStore.ts), its diff and the conflict
// check before running. Sign-up forms are edited on the sign-ups page.
import slugify from 'slug'
import { AgentError } from '../agentApi'
import pool, { withTransaction } from '../db_pg'
import {
  eventFromStored,
  eventsChanged,
  getEvent,
  getFreeSlug,
  lockEvent,
  saveEvent,
  type StoredEvent,
} from '../eventStore'
import { eventMoment, formatSessionTime, getSignupTargets } from '../eventUtils'
import { postImageUrl, readMedia, uploadEventImage } from '../mediaStore'
import { deleteSignupForms, getSignupFormKeysOfEvent, getSignupSummaries, totalSignups } from '../signupForms'
import { markEventSaved } from '../postStore'
import { fillPlaceholders, type PlaceholderSession } from './render'
import type {
  DiffLine,
  EventChange,
  Post,
  SessionChange,
  TextChoice,
  WebsiteChange,
  WebsiteChangePreview,
} from './types'

// Event frontmatter fields a website change can set, and the long description
const CHANGE_FIELDS = [
  'name',
  'sessions',
  'signupMode',
  'image',
  'visibleOnCalendar',
  'visibleOnEventsPage',
  'description',
  'body',
] as const
type ChangeField = (typeof CHANGE_FIELDS)[number]

const FIELD_LABELS: Record<ChangeField, string> = {
  name: 'Name',
  sessions: 'Times and places',
  signupMode: 'Sign-up',
  image: 'Image',
  visibleOnCalendar: 'Shown on calendar',
  visibleOnEventsPage: 'Shown on events page',
  description: 'Short description',
  body: 'Long description',
}

const changedFields = (event: EventChange): ChangeField[] =>
  CHANGE_FIELDS.filter((field) => event[field] !== undefined)

// The sessions after the change for {{date}} etc.
const placeholderSessions = (data: Record<string, unknown>): PlaceholderSession[] =>
  (Array.isArray(data.sessions) ? (data.sessions as SessionChange[]) : [])
    .map((s) => ({
      label: s.name || eventMoment(s.start).format('D.M.YYYY'),
      start: s.start,
      location: s.location,
      signupOpens: null,
    }))
    .sort((a, b) => eventMoment(a.start).valueOf() - eventMoment(b.start).valueOf())

// Text of an event field: the post's text with placeholders filled in (no ref,
// since the link is on the site itself, and dates without "today"), or its own text
const resolveText = (
  choice: TextChoice,
  post: Post,
  slug: string | null,
  signupSessions: (string | undefined)[] | null,
  sessions: PlaceholderSession[]
) =>
  'fromPost' in choice
    ? fillPlaceholders(post.bodyMd, {
        baseUrl: 'https://aaltogamers.fi',
        ref: '',
        eventSlug: slug,
        signupSessions,
        sessions,
      }).text.trim()
    : choice.text.trim()

type ResolvedEvent = {
  data: Record<string, unknown>
  body: string
  // An uploaded post image that becomes the event's image
  upload?: { mediaId: string }
}

const sessionsToContent = (sessions: SessionChange[]) =>
  sessions.map((s) => ({
    ...(s.name && { name: s.name }),
    start: s.start,
    end: s.end,
    location: s.location,
    id: s.id,
  }))

// The event's fields and long description after the change. An uploaded post
// image is the post's file until it has been copied as an event image (`eventImageUrl`).
export const resolveEvent = (
  post: Post,
  change: WebsiteChange,
  file: StoredEvent | null,
  slug: string | null,
  eventImageUrl?: string
): ResolvedEvent => {
  const { event } = change
  const data: Record<string, unknown> =
    change.kind === 'create_event' || !file
      ? {
          name: '',
          sessions: [],
          signupMode: 'none',
          visibleOnCalendar: true,
          visibleOnEventsPage: true,
          description: '',
          recordings: [],
        }
      : { ...file.data }
  let body = change.kind === 'update_event' && file ? file.body : ''
  let upload: ResolvedEvent['upload']

  if (event.name !== undefined) data.name = event.name
  if (event.sessions !== undefined) data.sessions = sessionsToContent(event.sessions)
  if (event.signupMode !== undefined) data.signupMode = event.signupMode
  if (event.visibleOnCalendar !== undefined) data.visibleOnCalendar = event.visibleOnCalendar
  if (event.visibleOnEventsPage !== undefined) data.visibleOnEventsPage = event.visibleOnEventsPage
  if (event.image !== undefined) {
    if (event.image === null) {
      delete data.image
    } else if ('sitePath' in event.image) {
      data.image = event.image.sitePath
    } else {
      const image = post.images[event.image.postImage]
      if (image && 'sitePath' in image) {
        data.image = image.sitePath
      } else if (image && 'mediaId' in image) {
        data.image = eventImageUrl ?? postImageUrl(image.mediaId)
        upload = { mediaId: image.mediaId }
      }
    }
  }
  // Texts last, so that their sign-up links know the event's sessions
  const signupSessions = signupSessionsAfterChange({ data, body })
  const sessions = placeholderSessions(data)
  if (event.description !== undefined) {
    data.description = resolveText(event.description, post, slug, signupSessions, sessions)
  }
  if (event.body !== undefined) body = resolveText(event.body, post, slug, signupSessions, sessions)
  // No long description: the short one
  if (!body && (change.kind === 'create_event' || event.body !== undefined)) body = String(data.description ?? '')
  return { data, body, upload }
}

const formatSessions = (raw: unknown) => {
  const sessions = Array.isArray(raw) ? (raw as SessionChange[]) : []
  if (!sessions.length) return '(none)'
  return sessions
    .map((s) => {
      const time = formatSessionTime({ start: s.start, end: s.end || s.start, location: s.location })
      return `${s.name ? `${s.name}: ` : ''}${time} @ ${s.location}`
    })
    .join('\n')
}

const formatValue = (field: ChangeField, value: unknown): string => {
  if (field === 'sessions') return formatSessions(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (field === 'signupMode') {
    return value === 'event' ? 'one for the whole event' : value === 'session' ? 'one per session' : 'none'
  }
  if (value === undefined || value === null || value === '') return '(empty)'
  return String(value)
}

const currentValue = (field: ChangeField, file: StoredEvent | null): unknown => {
  if (!file) return undefined
  if (field === 'body') return file.body
  if (field === 'visibleOnCalendar' || field === 'visibleOnEventsPage') {
    return file.data[field] !== false
  }
  if (field === 'signupMode') return file.data.signupMode ?? 'none'
  return file.data[field]
}

const newValue = (field: ChangeField, resolved: ResolvedEvent) =>
  field === 'body' ? resolved.body : resolved.data[field]

// Current → new for each field the change sets
export const diffEvent = (
  change: WebsiteChange,
  file: StoredEvent | null,
  resolved: ResolvedEvent
): DiffLine[] => {
  const fields: ChangeField[] =
    change.kind === 'create_event'
      ? ['name', 'sessions', 'signupMode', 'image', 'visibleOnCalendar', 'visibleOnEventsPage', 'description', 'body']
      : changedFields(change.event)
  return fields.flatMap((field) => {
    const from = change.kind === 'create_event' ? '' : formatValue(field, currentValue(field, file))
    const to = formatValue(field, newValue(field, resolved))
    if (change.kind === 'update_event' && from === to) return []
    return [{ field: FIELD_LABELS[field], from, to }]
  })
}

const comparable = (value: unknown) => JSON.stringify(value ?? null)

// Values of the changed fields now, stored at approval to detect conflicts
export const snapshotBase = (change: WebsiteChange, file: StoredEvent | null) =>
  change.kind === 'update_event' && file
    ? Object.fromEntries(changedFields(change.event).map((f) => [f, currentValue(f, file) ?? null]))
    : null

const conflictingFields = (base: Record<string, unknown>, file: StoredEvent) =>
  (Object.keys(base) as ChangeField[]).filter(
    (field) => comparable(base[field]) !== comparable(currentValue(field, file))
  )

// Slugs taken by other approved, not yet run new events
const reservedSlugs = async (postId: string): Promise<string[]> => {
  const result = await pool.query<{ event_slug: string }>(
    `SELECT w.event_slug FROM post_website_changes w JOIN posts p ON p.id = w.post_id
     WHERE w.kind = 'create_event' AND w.event_slug IS NOT NULL AND w.post_id <> $1
       AND w.status IN ('pending', 'sending', 'failed') AND p.status = 'scheduled'`,
    [postId]
  )
  return result.rows.map((r) => r.event_slug)
}

// The slug a new event gets: like getFreeSlug, from the name with -1, -2... if taken
export const chooseNewEventSlug = async (post: Post, change: WebsiteChange) => {
  const name = change.event.name ?? 'event'
  const reserved = await reservedSlugs(post.id)
  const base = await getFreeSlug(name)
  if (!reserved.includes(base)) return base
  for (let i = 1; ; i++) {
    const candidate = await getFreeSlug(`${name}-${i}`)
    if (!reserved.includes(candidate)) return candidate
  }
}

// The event the change applies to, and its slug (a guess for a new event before approval)
export const loadChangeTarget = async (change: WebsiteChange) => {
  if (change.kind === 'update_event') {
    const file = change.eventSlug ? await getEvent(change.eventSlug) : null
    return { file, slug: change.eventSlug, slugIsFinal: true }
  }
  if (change.eventSlug) return { file: null, slug: change.eventSlug, slugIsFinal: true }
  return { file: null, slug: slugify(change.event.name ?? '') || 'event', slugIsFinal: false }
}

// Session names of the event after the change that sign-up links can point to
export const signupSessionsAfterChange = (resolved: Pick<ResolvedEvent, 'data' | 'body'>) => {
  const mode = resolved.data.signupMode
  if (mode === 'event') return []
  if (mode === 'session') {
    return (Array.isArray(resolved.data.sessions) ? (resolved.data.sessions as SessionChange[]) : []).map(
      (s) => s.name || eventMoment(s.start).format('D.M.YYYY')
    )
  }
  return null
}

// Diff and problems of a website change
export const previewWebsiteChange = async (
  post: Post,
  change: WebsiteChange,
  runAt: string | null
): Promise<WebsiteChangePreview & { resolved: ResolvedEvent | null }> => {
  const errors: string[] = []
  const warnings: string[] = []
  const { file, slug, slugIsFinal } = await loadChangeTarget(change)
  const empty = { kind: change.kind, eventSlug: slug, timing: change.timing, runAt, diff: [], page: null, resolved: null }

  if (change.kind === 'update_event' && !file) {
    return { ...empty, errors: [`No event with slug "${change.eventSlug}"`], warnings }
  }
  if (change.kind === 'create_event') {
    if (!change.event.name) errors.push('The new event needs a name')
    if (change.event.description === undefined) errors.push('The new event needs a short description')
    if (!slugIsFinal) warnings.push(`The event's address is chosen when the post is approved: /events/${slug} if it's still free`)
  } else if (!changedFields(change.event).length) {
    errors.push('The website change changes nothing')
  }
  if (change.event.image && 'postImage' in change.event.image) {
    const image = post.images[change.event.image.postImage]
    if (!image) errors.push(`The event image is image ${change.event.image.postImage + 1} of the post, which doesn't exist`)
    else if ('eventImage' in image) errors.push("The event image can't be the post's event image itself")
  }

  const resolved = resolveEvent(post, change, file, slug)
  const diff = diffEvent(change, file, resolved)
  const newEvent = eventFromStored({ slug: slug ?? '', data: resolved.data, body: resolved.body })
  const existingKeys = slug && file ? await getSignupFormKeysOfEvent(slug) : []
  const summaries = await getSignupSummaries(existingKeys)

  // Forms that would be left without a session or sign-up mode
  if (file && slug) {
    const newKeys = new Set(getSignupTargets({ ...newEvent, slug }).map((t) => t.key))
    const orphaned = summaries.filter((s) => !newKeys.has(s.key))
    orphaned
      .filter((s) => totalSignups(s) > 0)
      .forEach((s) =>
        errors.push(
          `Sign-up form "${s.key}" has ${totalSignups(s)} sign-up(s) and would be left without a session or sign-up mode. Keep its session (and session id) or the sign-up mode.`
        )
      )
    const empty = orphaned.filter((s) => totalSignups(s) === 0)
    if (empty.length) {
      warnings.push(`Empty sign-up forms that no longer belong to the event are deleted: ${empty.map((s) => s.key).join(', ')}`)
    }
  }

  const page = {
    event: { ...resolved.data, content: resolved.body, slug: slug ?? '' },
    imageUrls: resolved.upload
      ? { [String(resolved.data.image)]: `/api/posts/media/${resolved.upload.mediaId}` }
      : {},
  }
  return { kind: change.kind, eventSlug: slug, timing: change.timing, runAt, diff, page, errors, warnings, resolved }
}

export class WebsiteChangeConflict extends Error {}

// An uploaded post image copied as an event image: post uploads are cleaned up,
// event images aren't. A retry gets the same name, so nothing is copied twice.
const copyAsEventImage = async (mediaId: string) => {
  const data = await readMedia(postImageUrl(mediaId))
  if (!data) throw new WebsiteChangeConflict('The uploaded event image no longer exists')
  return uploadEventImage(data)
}

// Runs the change in one transaction: saves the event, deletes the empty sign-up
// forms that no longer belong to it and marks the change done. Returns the
// event's new version. A conflict throws WebsiteChangeConflict, which is not retried.
export const runWebsiteChange = async (
  post: Post,
  change: WebsiteChange,
  base: Record<string, unknown> | null
): Promise<number> => {
  const slug = change.eventSlug
  if (!slug) throw new WebsiteChangeConflict('The event has no slug; approve the post again')
  const preview = await previewWebsiteChange(post, change, null)
  if (preview.errors.length) throw new WebsiteChangeConflict(preview.errors.join('; '))
  const upload = preview.resolved?.upload
  const eventImageUrl = upload ? await copyAsEventImage(upload.mediaId) : undefined

  const version = await withTransaction(async (client) => {
    const file = await lockEvent(slug, client)
    if (change.kind === 'create_event' && file) {
      throw new WebsiteChangeConflict(
        `The address /events/${slug} has been taken since the post was approved. Retry to pick a new one.`
      )
    }
    if (change.kind === 'update_event') {
      if (!file) throw new WebsiteChangeConflict(`The event "${slug}" no longer exists`)
      const conflicts = base ? conflictingFields(base, file) : []
      if (conflicts.length) {
        throw new WebsiteChangeConflict(
          `${conflicts.map((f) => FIELD_LABELS[f]).join(', ')} of the event ${conflicts.length > 1 ? 'have' : 'has'} been changed (e.g. in the event editor) since the post was approved. Retry overwrites ${conflicts.length > 1 ? 'them' : 'it'} with the post's version.`
        )
      }
    }

    const resolved = resolveEvent(post, change, file, slug, eventImageUrl)
    const saved = await saveEvent(
      {
        slug,
        data: resolved.data,
        body: resolved.body,
        version: file?.version ?? null,
        author: `post #${post.id} v${post.version}`,
      },
      client
    ).catch((err) => {
      // Invalid fields don't get better by trying again
      if (err instanceof AgentError && err.status === 400) throw new WebsiteChangeConflict(err.message)
      throw err
    })

    // Like update_event: empty forms that no longer belong to the event
    if (file) {
      const newKeys = new Set(getSignupTargets(eventFromStored(saved)).map((t) => t.key))
      const existing = await getSignupSummaries(await getSignupFormKeysOfEvent(slug))
      await deleteSignupForms(
        existing.filter((s) => !newKeys.has(s.key) && totalSignups(s) === 0).map((s) => s.key),
        client
      )
    }
    await markEventSaved(post.id, saved.version, client)
    return saved.version
  })
  eventsChanged()
  return version
}

export const isConflict = (err: unknown) =>
  err instanceof WebsiteChangeConflict || (err instanceof AgentError && err.status === 409)
