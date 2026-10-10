// Website changes of posts: the event (eventFiles.ts) and its sign-up forms
// (signupForms.ts), their diffs and the conflict check before running.
import slugify from 'slug'
import moment from 'moment-timezone'
import { AgentError } from '../agentApi'
import {
  type EventFile,
  eventFromFile,
  getEventFile,
  getFreeSlug,
  IMAGES_DIR,
  saveEventFile,
} from '../eventFiles'
import { eventMoment, formatSessionTime, getSignupTargets } from '../eventUtils'
import {
  deleteSignupForms,
  formChangeError,
  getSignupFormKeysOfEvent,
  getSignupSummaries,
  saveSignupForm,
  totalSignups,
} from '../signupForms'
import pool from '../db_pg'
import { getMedia } from '../postStore'
import { fillPlaceholders } from './render'
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

// Text of an event field: the post's text with placeholders filled in (no ref,
// since the link is on the site itself), or its own text
const resolveText = (
  choice: TextChoice,
  post: Post,
  slug: string | null,
  signupSessions: (string | undefined)[] | null
) =>
  'fromPost' in choice
    ? fillPlaceholders(post.bodyMd, {
        baseUrl: 'https://aaltogamers.fi',
        ref: '',
        eventSlug: slug,
        signupSessions,
      }).text.trim()
    : choice.text.trim()

// Repo path and site path of an uploaded image committed as the event's image
const uploadedImagePaths = (slug: string, mediaId: string) => {
  const name = `${slug}-${mediaId.slice(0, 8)}.jpg`
  return { repoPath: `${IMAGES_DIR}/${name}`, sitePath: `/images/${name}` }
}

type ResolvedEvent = {
  data: Record<string, unknown>
  body: string
  // An uploaded image to commit with the event
  upload?: { mediaId: string; repoPath: string }
}

const sessionsToContent = (sessions: SessionChange[]) =>
  sessions.map((s) => ({
    ...(s.name && { name: s.name }),
    start: s.start,
    end: s.end,
    location: s.location,
    id: s.id,
  }))

// The event's frontmatter and long description after the change
export const resolveEvent = (
  post: Post,
  change: WebsiteChange,
  file: EventFile | null,
  slug: string | null
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
      } else if (image) {
        const paths = uploadedImagePaths(slug ?? 'event', image.mediaId)
        data.image = paths.sitePath
        upload = { mediaId: image.mediaId, repoPath: paths.repoPath }
      }
    }
  }
  // Texts last, so that their sign-up links know the event's sessions
  const signupSessions = signupSessionsAfterChange({ data, body })
  if (event.description !== undefined) {
    data.description = resolveText(event.description, post, slug, signupSessions)
  }
  if (event.body !== undefined) body = resolveText(event.body, post, slug, signupSessions)
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

const currentValue = (field: ChangeField, file: EventFile | null): unknown => {
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
  file: EventFile | null,
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
export const snapshotBase = (change: WebsiteChange, file: EventFile | null) =>
  change.kind === 'update_event' && file
    ? Object.fromEntries(changedFields(change.event).map((f) => [f, currentValue(f, file) ?? null]))
    : null

const conflictingFields = (base: Record<string, unknown>, file: EventFile) =>
  (Object.keys(base) as ChangeField[]).filter(
    (field) => comparable(base[field]) !== comparable(currentValue(field, file))
  )

// Sign-up form key of a form change, once the slug is known
const formKey = (slug: string, sessionId?: string) => (sessionId ? `${slug}:${sessionId}` : slug)

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

// The slug a new event gets: like the CMS, from the name with -1, -2... if taken
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
    const file = change.eventSlug ? await getEventFile(change.eventSlug) : null
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

const sessionLabel = (session?: SessionChange) =>
  session ? session.name || eventMoment(session.start).format('ddd D.M.YYYY HH:mm') : 'Whole event'

// Diff, sign-up form counts and problems of a website change
export const previewWebsiteChange = async (
  post: Post,
  change: WebsiteChange,
  runAt: string | null
): Promise<WebsiteChangePreview & { resolved: ResolvedEvent | null }> => {
  const errors: string[] = []
  const warnings: string[] = []
  const { file, slug, slugIsFinal } = await loadChangeTarget(change)
  const empty = { kind: change.kind, eventSlug: slug, runAt, diff: [], forms: [], resolved: null }

  if (change.kind === 'update_event' && !file) {
    return { ...empty, errors: [`No event with slug "${change.eventSlug}"`], warnings }
  }
  if (change.kind === 'create_event') {
    if (!change.event.name) errors.push('The new event needs a name')
    if (change.event.description === undefined) errors.push('The new event needs a short description')
    if (!slugIsFinal) warnings.push(`The event's address is chosen when the post is approved: /events/${slug} if it's still free`)
  } else if (!changedFields(change.event).length && !change.signupForms.length) {
    errors.push('The website change changes nothing')
  }
  if (change.event.image && 'postImage' in change.event.image && !post.images[change.event.image.postImage]) {
    errors.push(`The event image is image ${change.event.image.postImage + 1} of the post, which doesn't exist`)
  }

  const resolved = resolveEvent(post, change, file, slug)
  const diff = diffEvent(change, file, resolved)
  const newEvent = eventFromFile({ slug: slug ?? '', data: resolved.data, body: resolved.body, sha: '' })
  const sessions = (Array.isArray(resolved.data.sessions) ? resolved.data.sessions : []) as SessionChange[]
  const mode = newEvent.signupMode

  // Sign-up forms
  const existingKeys = slug && file ? await getSignupFormKeysOfEvent(slug) : []
  const summaries = await getSignupSummaries(existingKeys)
  const forms: WebsiteChangePreview['forms'] = []
  for (const [i, { sessionId, form }] of change.signupForms.entries()) {
    const session = sessions.find((s) => s.id === sessionId)
    if (mode === 'none') {
      errors.push('Sign-up forms need the event to have sign-ups (sign-up mode "event" or "session")')
      break
    }
    if (mode === 'event' && sessionId) {
      errors.push(`Sign-up form ${i + 1} is for a session, but the event has one sign-up for the whole event`)
      continue
    }
    if (mode === 'session' && !session) {
      errors.push(`Sign-up form ${i + 1} is for a session the event doesn't have; the event has one sign-up per session`)
      continue
    }
    const key = slug ? formKey(slug, sessionId) : '(new event)'
    const existing = summaries.find((s) => s.key === key)
    if (existing && file) {
      const problem = await formChangeError(key, form)
      if (problem) errors.push(problem)
    }
    if (moment(form.openuntil).isBefore(moment())) {
      warnings.push(`Sign-up form for ${sessionLabel(session)} closes before now`)
    }
    forms.push({
      key,
      label: sessionLabel(session),
      isNew: !existing,
      signups: existing ? totalSignups(existing) : 0,
    })
  }

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

  return { kind: change.kind, eventSlug: slug, runAt, diff, forms, errors, warnings, resolved }
}

export class WebsiteChangeConflict extends Error {}

// Runs the change: commits the event file (with an uploaded image), then saves
// the sign-up forms. A conflict throws WebsiteChangeConflict, which is not retried.
export const runWebsiteChange = async (
  post: Post,
  change: WebsiteChange,
  base: Record<string, unknown> | null,
  eventSaved: boolean,
  onEventSaved: (commitSha: string | null) => Promise<void>
): Promise<string | null> => {
  const slug = change.eventSlug
  if (!slug) throw new WebsiteChangeConflict('The event has no slug; approve the post again')
  const file = await getEventFile(slug)
  let commitSha = change.commitSha ?? null

  if (!eventSaved) {
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
          `${conflicts.map((f) => FIELD_LABELS[f]).join(', ')} of the event ${conflicts.length > 1 ? 'have' : 'has'} been changed (e.g. in the CMS) since the post was approved. Retry overwrites ${conflicts.length > 1 ? 'them' : 'it'} with the post's version.`
        )
      }
    }

    const preview = await previewWebsiteChange(post, change, null)
    if (preview.errors.length) throw new WebsiteChangeConflict(preview.errors.join('; '))
    const resolved = resolveEvent(post, change, file, slug)
    const extraFiles = []
    if (resolved.upload) {
      const media = await getMedia(resolved.upload.mediaId)
      if (!media) throw new WebsiteChangeConflict('The uploaded event image no longer exists')
      extraFiles.push({ path: resolved.upload.repoPath, content: media.data })
    }
    const verb = change.kind === 'create_event' ? 'Create' : 'Update'
    commitSha =
      (await saveEventFile(
        slug,
        resolved.data,
        resolved.body,
        `${verb} Event “${slug}” (scheduled post #${post.id})`,
        file?.sha || undefined,
        extraFiles
      )) ?? null
    await onEventSaved(commitSha)

    // Like update_event: empty forms that no longer belong to the event
    if (file) {
      const newEvent = eventFromFile({ slug, data: resolved.data, body: resolved.body, sha: '' })
      const newKeys = new Set(getSignupTargets(newEvent).map((t) => t.key))
      const existing = await getSignupSummaries(await getSignupFormKeysOfEvent(slug))
      await deleteSignupForms(
        existing.filter((s) => !newKeys.has(s.key) && totalSignups(s) === 0).map((s) => s.key)
      )
    }
  }

  for (const { sessionId, form } of change.signupForms) {
    const key = formKey(slug, sessionId)
    const problem = await formChangeError(key, form)
    if (problem) throw new WebsiteChangeConflict(problem)
    const result = await saveSignupForm({ key, ...form })
    if ('error' in result) throw new WebsiteChangeConflict(`Sign-up form "${key}": ${result.error}`)
  }
  return commitSha
}

export const isConflict = (err: unknown) =>
  err instanceof WebsiteChangeConflict || (err instanceof AgentError && err.status === 409)
