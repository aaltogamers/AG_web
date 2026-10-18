// Events in Postgres: the only way to read and write them. Used by the pages, the
// admin event editor, the AI agent MCP server and the website changes of posts.
// `data` is the event's fields (like the frontmatter of the old event files) and
// `body` its long description. Times are Helsinki wall-clock strings like
// 2026-10-24T18:00:00.
import crypto from 'crypto'
import moment from 'moment-timezone'
import type { PoolClient } from 'pg'
import slugify from 'slug'
import type { AGEvent } from '../types/types'
import { AgentError } from './agentApi'
import pool, { ensureMigrated, withTransaction } from './db_pg'
import { EVENT_TIMEZONE, normalizeEvent } from './eventUtils'
import { isMediaUrl } from './mediaStore'

export type StoredEvent = {
  slug: string
  data: Record<string, unknown>
  body: string
  // Increased on every save; a save must give the version it was made on
  version: number
}

type EventRow = StoredEvent

const COLUMNS = 'slug, data, body, version'

export const eventFromStored = (event: Pick<StoredEvent, 'slug' | 'data' | 'body'>): AGEvent =>
  normalizeEvent({ ...event.data, content: event.body, slug: event.slug })

export const isValidSlug = (slug: string) => /^[a-z0-9-]+$/.test(slug)

// In-memory list of all events, so that pages never wait for the database. Loaded
// at startup (instrumentation.ts) and reloaded right after every write. All writes
// go through this file and the site runs as one instance, so it never expires.
// Kept on globalThis so that pages, the calendar route, the API routes and
// instrumentation.ts (separate bundles) share it.
type Cache = {
  events: StoredEvent[] | null
  // Bumped by every write, so that a reload that started before it isn't stored
  generation: number
  // The generation `events` was loaded in
  loadedGeneration: number
  loading: { generation: number; promise: Promise<StoredEvent[]> } | null
  // Whether writes reload the list right away (only in the server, not in scripts)
  isPreloaded: boolean
}

const globalForEvents = globalThis as unknown as { __agEvents?: Cache }
const cache = (globalForEvents.__agEvents ??= {
  events: null,
  generation: 0,
  loadedGeneration: -1,
  loading: null,
  isPreloaded: false,
})

// Call after the COMMIT of a transaction that saved an event with a client
export const eventsChanged = () => {
  cache.generation++
  if (cache.isPreloaded) {
    reload().catch((err) => console.error('[events] reloading events failed:', err))
  }
}

const reload = (): Promise<StoredEvent[]> => {
  // Concurrent reloads share one query, unless it started before a write
  if (cache.loading?.generation === cache.generation) return cache.loading.promise
  const generation = cache.generation
  const promise = (async () => {
    await ensureMigrated()
    const result = await pool.query<EventRow>(`SELECT ${COLUMNS} FROM events`)
    if (cache.generation === generation) {
      cache.events = result.rows
      cache.loadedGeneration = generation
    }
    return result.rows
  })().finally(() => {
    if (cache.loading?.promise === promise) cache.loading = null
  })
  cache.loading = { generation, promise }
  return promise
}

// Loads the list at startup, and makes writes reload it right away
export const preloadEvents = async () => {
  cache.isPreloaded = true
  try {
    await reload()
    console.log('[events] loaded events')
  } catch (err) {
    // The first page that needs them tries again
    console.error('[events] loading events failed:', err)
  }
}

// All events, from the in-memory list. Only waits for the database when the list
// hasn't been loaded yet, or a write is still reloading it. If reloading fails, the
// last list is used, so a short database outage doesn't take down the site.
export const listEvents = async (): Promise<StoredEvent[]> => {
  if (cache.events && cache.loadedGeneration === cache.generation) return cache.events
  try {
    return await reload()
  } catch (err) {
    if (!cache.events) throw err
    console.error('[events] reloading events failed, using the last list:', err)
    return cache.events
  }
}

// All events, for the pages
export const getEvents = async (): Promise<AGEvent[]> => (await listEvents()).map(eventFromStored)

// One event, straight from the database (e.g. before changing it)
export const getEvent = async (slug: string, client?: PoolClient): Promise<StoredEvent | null> => {
  if (!isValidSlug(slug)) return null
  await ensureMigrated()
  const result = await (client ?? pool).query<EventRow>(`SELECT ${COLUMNS} FROM events WHERE slug = $1`, [slug])
  return result.rows[0] ?? null
}

// One event, locked until the end of the client's transaction
export const lockEvent = async (slug: string, client: PoolClient): Promise<StoredEvent | null> => {
  if (!isValidSlug(slug)) return null
  const result = await client.query<EventRow>(`SELECT ${COLUMNS} FROM events WHERE slug = $1 FOR UPDATE`, [slug])
  return result.rows[0] ?? null
}

// Like Decap: the slug comes from the name, with -1, -2... if it's taken
export const getFreeSlug = async (name: string): Promise<string> => {
  const base = slugify(name) || 'event'
  await ensureMigrated()
  const result = await pool.query<{ slug: string }>(
    `SELECT slug FROM events WHERE slug = $1 OR slug LIKE $1 || '-%'`,
    [base]
  )
  const taken = new Set(result.rows.map((r) => r.slug))
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`
    if (!taken.has(candidate)) return candidate
  }
}

// Session ids tie sign-up forms to sessions, so they survive edits to a session's
// name or time. Same format as the ids the old CMS gave.
export const randomSessionId = () =>
  Array.from(crypto.randomBytes(8), (b) => (b % 36).toString(36)).join('')

// Validation

const FIELDS = [
  'name',
  'sessions',
  'signupMode',
  'image',
  'visibleOnCalendar',
  'visibleOnEventsPage',
  'description',
  'recordings',
]
const SIGNUP_MODES = ['none', 'event', 'session']
const SITE_IMAGE = /^\/[A-Za-z0-9._\-/ ]+\.(png|jpe?g|webp|gif)$/i

export const isEventImage = (image: string) =>
  (SITE_IMAGE.test(image) && !image.includes('..')) || isMediaUrl(image)

const parseTime = (value: unknown, name: string) => {
  const time =
    typeof value === 'string'
      ? moment.tz(value, ['YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DDTHH:mm'], true, EVENT_TIMEZONE)
      : null
  if (!time?.isValid()) throw new AgentError(400, `${name} must be a time like 2026-10-24T18:00:00`)
  return time
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

// Checks an event's fields and fills in defaults and missing session ids.
// Throws AgentError(400) with what's wrong.
export const validateEvent = (raw: Record<string, unknown>): Record<string, unknown> => {
  const unknown = Object.keys(raw).filter((key) => !FIELDS.includes(key))
  if (unknown.length) throw new AgentError(400, `Unknown event fields: ${unknown.join(', ')}`)
  const data: Record<string, unknown> = { ...raw }

  if (typeof data.name !== 'string' || !data.name.trim()) throw new AgentError(400, 'The event needs a name')
  if (data.description === undefined) data.description = ''
  if (typeof data.description !== 'string') throw new AgentError(400, 'The short description must be text')

  if (data.sessions === undefined) data.sessions = []
  if (!Array.isArray(data.sessions)) throw new AgentError(400, 'sessions must be a list')
  data.sessions = data.sessions.map((session: unknown, i) => {
    const name = `Session ${i + 1}`
    if (!isRecord(session)) throw new AgentError(400, `${name} must be an object`)
    const start = parseTime(session.start, `${name}: the start`)
    const end = parseTime(session.end, `${name}: the end`)
    if (end.isBefore(start)) throw new AgentError(400, `${name} ends before it starts`)
    if (typeof session.location !== 'string' || !session.location.trim()) {
      throw new AgentError(400, `${name} needs a location`)
    }
    if (session.name !== undefined && typeof session.name !== 'string') {
      throw new AgentError(400, `${name}: the name must be text`)
    }
    if (session.id !== undefined && (typeof session.id !== 'string' || !session.id)) {
      throw new AgentError(400, `${name}: the id must be text`)
    }
    return { ...session, id: session.id || randomSessionId() }
  })
  const ids = (data.sessions as { id: string }[]).map((s) => s.id)
  if (new Set(ids).size !== ids.length) throw new AgentError(400, 'Two sessions have the same id')

  if (data.signupMode === undefined) data.signupMode = 'none'
  if (!SIGNUP_MODES.includes(data.signupMode as string)) {
    throw new AgentError(400, `signupMode must be one of ${SIGNUP_MODES.join(', ')}`)
  }
  if (data.image === null || data.image === '') delete data.image
  if (data.image !== undefined && (typeof data.image !== 'string' || !isEventImage(data.image))) {
    throw new AgentError(400, `The image must be an uploaded image or a path like /images/foo.png`)
  }
  for (const field of ['visibleOnCalendar', 'visibleOnEventsPage']) {
    if (data[field] === undefined) data[field] = true
    if (typeof data[field] !== 'boolean') throw new AgentError(400, `${field} must be true or false`)
  }
  if (data.recordings !== undefined) {
    if (!Array.isArray(data.recordings)) throw new AgentError(400, 'recordings must be a list')
    data.recordings.forEach((r: unknown, i) => {
      if (!isRecord(r) || typeof r.url !== 'string' || !r.url.trim()) {
        throw new AgentError(400, `Recording ${i + 1} needs a URL`)
      }
    })
  }
  return data
}

// Writes

const changedError = () =>
  new AgentError(409, 'The event has been changed by someone else since it was loaded. Reload and try again.')

type SaveInput = {
  slug: string
  data: Record<string, unknown>
  body: string
  // The version the change was made on; null creates the event
  version: number | null
  // 'admin', 'AI agent', 'post #12 v3', 'import'
  author: string
}

const writeRevision = (client: PoolClient, event: StoredEvent | (Omit<StoredEvent, 'data' | 'body'> & { data: null; body: null }), author: string) =>
  client.query(
    'INSERT INTO event_revisions (slug, data, body, version, author) VALUES ($1, $2, $3, $4, $5)',
    [event.slug, event.data && JSON.stringify(event.data), event.body, event.version, author]
  )

// Without a client, in its own transaction, clearing the cache after it. With a
// client, the caller calls eventsChanged() after its COMMIT (never before, or a
// reload could read the old rows and keep them for 60 s).
const write = async <T>(client: PoolClient | undefined, run: (client: PoolClient) => Promise<T>) => {
  if (client) return run(client)
  await ensureMigrated()
  const result = await withTransaction(run)
  eventsChanged()
  return result
}

// Creates (version null) or updates an event. Throws 409 if the slug is taken or
// the event has been changed since `version`.
export const saveEvent = async (input: SaveInput, client?: PoolClient): Promise<StoredEvent> => {
  if (!isValidSlug(input.slug)) throw new AgentError(400, `"${input.slug}" is not a valid slug`)
  const data = validateEvent(input.data)
  const body = input.body.trim()
  return write(client, async (c) => {
    const result =
      input.version === null
        ? await c.query<EventRow>(
            `INSERT INTO events (slug, data, body, version) VALUES ($1, $2, $3, 1)
             ON CONFLICT (slug) DO NOTHING RETURNING ${COLUMNS}`,
            [input.slug, JSON.stringify(data), body]
          )
        : await c.query<EventRow>(
            `UPDATE events SET data = $2, body = $3, version = version + 1, updated_at = now()
             WHERE slug = $1 AND version = $4 RETURNING ${COLUMNS}`,
            [input.slug, JSON.stringify(data), body, input.version]
          )
    const saved = result.rows[0]
    if (!saved) {
      if (input.version === null) throw new AgentError(409, `There is already an event at /events/${input.slug}`)
      throw changedError()
    }
    await writeRevision(c, saved, input.author)
    return saved
  })
}

export const deleteEvent = async (slug: string, version: number, author: string, client?: PoolClient) =>
  write(client, async (c) => {
    const result = await c.query('DELETE FROM events WHERE slug = $1 AND version = $2', [slug, version])
    if (!result.rowCount) throw changedError()
    await writeRevision(c, { slug, data: null, body: null, version: version + 1 }, author)
  })
