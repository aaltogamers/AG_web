// Event and sign-up form logic of the AI agent API (/api/agent/events, /api/agent/signup-forms)
import moment from 'moment-timezone'
import type { AGEvent, SignupInput, SignupMode, SignupPool } from '../types/types'
import {
  AgentError,
  asRecord,
  formatAgentTime,
  optionalArray,
  optionalBoolean,
  optionalString,
  parseAgentTime,
  requireString,
} from './agentApi'
import { randomSessionId } from './eventFiles'
import { eventMoment, getSignupStatus, getSignupTargets, type SignupTarget } from './eventUtils'
import { getSignupSummaries, totalSignups } from './signupForms'
import type { SignupSummary } from './signupApi'
import { poolFill } from './signupPools'

const SIGNUP_MODES: SignupMode[] = ['none', 'event', 'session']
const EVENT_FIELDS = [
  'name',
  'description',
  'body',
  'sessions',
  'signupMode',
  'image',
  'visibleOnCalendar',
  'visibleOnEventsPage',
  'recordings',
]

// Same format as the CMS datetime widget
const toContentTime = (time: moment.Moment) => time.format('YYYY-MM-DDTHH:mm:ss')

const parseSession = (raw: unknown, i: number, existingIds: Set<string>) => {
  const s = asRecord(raw, `sessions[${i}]`)
  const start = parseAgentTime(s.start, `sessions[${i}].start`)
  const end = s.end ? parseAgentTime(s.end, `sessions[${i}].end`) : start.clone().add(2, 'hours')
  if (end.isBefore(start)) throw new AgentError(400, `sessions[${i}].end is before its start`)
  const id = optionalString(s.id, `sessions[${i}].id`)
  if (id && !existingIds.has(id)) {
    throw new AgentError(
      400,
      `sessions[${i}].id "${id}" is not an existing session of this event. Leave id out for new sessions.`
    )
  }
  const name = optionalString(s.name, `sessions[${i}].name`)
  return {
    ...(name && { name }),
    start: toContentTime(start),
    end: toContentTime(end),
    location: requireString(s.location, `sessions[${i}].location`),
    id: id ?? randomSessionId(),
  }
}

// Turns event fields sent by the agent into frontmatter values. Only the given
// fields are returned; `null` clears an optional field.
export const parseEventInput = (
  input: Record<string, unknown>,
  existingSessionIds: Set<string>
): { data: Record<string, unknown>; body?: string } => {
  const unknown = Object.keys(input).filter((k) => !EVENT_FIELDS.includes(k))
  if (unknown.length) {
    throw new AgentError(
      400,
      `Unknown fields: ${unknown.join(', ')}. Allowed: ${EVENT_FIELDS.join(', ')}`
    )
  }

  const data: Record<string, unknown> = {}
  if ('name' in input) data.name = requireString(input.name, 'name')
  if ('description' in input) data.description = requireString(input.description, 'description')
  if ('sessions' in input) {
    const sessions = optionalArray(input.sessions, 'sessions') ?? []
    data.sessions = sessions.map((s, i) => parseSession(s, i, existingSessionIds))
  }
  if ('signupMode' in input) {
    const mode = SIGNUP_MODES.find((m) => m === input.signupMode)
    if (!mode) throw new AgentError(400, `signupMode must be one of ${SIGNUP_MODES.join(', ')}`)
    data.signupMode = mode
  }
  if ('image' in input) data.image = optionalString(input.image, 'image')
  if ('visibleOnCalendar' in input) {
    data.visibleOnCalendar = optionalBoolean(input.visibleOnCalendar, 'visibleOnCalendar') ?? true
  }
  if ('visibleOnEventsPage' in input) {
    data.visibleOnEventsPage =
      optionalBoolean(input.visibleOnEventsPage, 'visibleOnEventsPage') ?? true
  }
  if ('recordings' in input) {
    data.recordings = (optionalArray(input.recordings, 'recordings') ?? []).map((raw, i) => {
      const r = asRecord(raw, `recordings[${i}]`)
      return {
        name: optionalString(r.name, `recordings[${i}].name`) ?? 'Recording',
        url: requireString(r.url, `recordings[${i}].url`),
      }
    })
  }

  const body = 'body' in input ? (optionalString(input.body, 'body') ?? '') : undefined
  return { data, body }
}

export const eventUrl = (slug: string) => `https://aaltogamers.fi/events/${slug}`

export const describeEvent = (event: AGEvent, withBody = false) => ({
  slug: event.slug,
  url: eventUrl(event.slug),
  name: event.name,
  sessions: event.sessions.map((s) => ({
    id: s.id,
    name: s.name,
    start: formatAgentTime(eventMoment(s.start)),
    end: formatAgentTime(eventMoment(s.end)),
    location: s.location,
  })),
  signupMode: event.signupMode,
  // Keys of the sign-up forms this event can have, one per session in `session` mode
  signupFormKeys: getSignupTargets(event).map((t) => t.key),
  image: event.image,
  visibleOnCalendar: event.visibleOnCalendar,
  visibleOnEventsPage: event.visibleOnEventsPage,
  description: event.description,
  ...(withBody && { body: event.content, recordings: event.recordings }),
})

// Sign-up forms that have participants among the given keys; they must not be deleted
export const formsWithParticipants = async (keys: string[]) =>
  (await getSignupSummaries(keys)).filter((s) => totalSignups(s) > 0)

export const participantsError = (forms: SignupSummary[], action: string) =>
  new AgentError(
    409,
    `Can't ${action}: ${forms
      .map((f) => `sign-up form "${f.key}" has ${totalSignups(f)} sign-up(s)`)
      .join(', ')}. Forms with sign-ups can only be removed by a human in the admin panel.`
  )

// Sign-up forms

const INPUT_TYPES = ['text', 'select', 'info'] as const

export const parsePools = (raw: unknown, existing: SignupPool[] = []): SignupPool[] => {
  const pools = optionalArray(raw, 'pools')
  if (!pools?.length) throw new AgentError(400, 'pools must have at least one pool')
  return pools.map((rawPool, i) => {
    const p = asRecord(rawPool, `pools[${i}]`)
    const id = Number(p.id) || 0
    const size = Number(p.size)
    if (!Number.isInteger(size) || size < 0) {
      throw new AgentError(400, `pools[${i}].size must be a whole number >= 0`)
    }
    const pool: SignupPool = { id, name: requireString(p.name, `pools[${i}].name`), size }
    if (optionalBoolean(p.private, `pools[${i}].private`)) {
      pool.private = true
      // Keep the current password unless a new one is given
      pool.password =
        optionalString(p.password, `pools[${i}].password`) ??
        existing.find((e) => e.id === id)?.password
    }
    return pool
  })
}

export const parseFields = (raw: unknown): SignupInput[] =>
  (optionalArray(raw, 'fields') ?? []).map((rawField, i) => {
    const f = asRecord(rawField, `fields[${i}]`)
    const type = INPUT_TYPES.find((t) => t === f.type)
    if (!type) throw new AgentError(400, `fields[${i}].type must be text, select or info`)
    const field: SignupInput = {
      id: Number(f.id) || 0,
      number: i + 1,
      type,
      title: requireString(f.title, `fields[${i}].title`),
      public: optionalBoolean(f.public, `fields[${i}].public`) ?? false,
      required: optionalBoolean(f.required, `fields[${i}].required`) ?? false,
    }
    const description = optionalString(f.description, `fields[${i}].description`)
    if (description) field.description = description
    if (type === 'select') {
      const options =
        typeof f.options === 'string'
          ? f.options.split(',')
          : (optionalArray(f.options, `fields[${i}].options`) ?? [])
      field.options = options.map((o) => String(o).trim()).filter(Boolean)
      if (!field.options.length) {
        throw new AgentError(400, `fields[${i}].options is required for select fields`)
      }
      field.multi = optionalBoolean(f.multi, `fields[${i}].multi`) ?? false
    }
    return field
  })

export const describeForm = (form: SignupSummary, target?: SignupTarget) => ({
  key: form.key,
  sessionId: target?.session?.id,
  sessionName: target?.session?.name,
  sessionStart: target?.session && formatAgentTime(eventMoment(target.session.start)),
  openFrom: formatAgentTime(form.openfrom),
  openUntil: formatAgentTime(form.openuntil),
  status: getSignupStatus(form),
  totalSignups: totalSignups(form),
  pools: form.pools.map((p) => {
    const count = form.counts[p.id] ?? 0
    return {
      id: p.id,
      name: p.name,
      size: p.size,
      private: !!p.private,
      ...(p.private && { password: p.password }),
      signups: count,
      reserve: poolFill(p, count).reserve,
    }
  }),
  fields: form.inputs.map((f) => ({
    id: f.id,
    type: f.type,
    title: f.title,
    description: f.description,
    required: f.required,
    public: f.public,
    ...(f.type === 'select' && { options: f.options, multi: f.multi }),
  })),
})
