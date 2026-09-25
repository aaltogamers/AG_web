import moment, { Moment } from 'moment-timezone'
import { AGEvent, EventSession, SignupMode } from '../types/types'

export const EVENT_TIMEZONE = 'Europe/Helsinki'
export const DEFAULT_EVENT_IMAGE = '/images/ag-logo-new.png'

// Times in content have no offset and are Helsinki wall-clock times
export const eventMoment = (time: string): Moment => moment.tz(time, EVENT_TIMEZONE)

type Raw = Record<string, unknown>

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const asRecords = (value: unknown): Raw[] =>
  Array.isArray(value) ? value.filter((v): v is Raw => !!v && typeof v === 'object') : []

const normalizeSession = (raw: Raw): EventSession | null => {
  const start = asString(raw.start)
  if (!start) return null
  const name = asString(raw.name)
  const id = asString(raw.id)
  return {
    ...(name && { name }),
    start,
    end: asString(raw.end) || start,
    location: asString(raw.location) || '',
    ...(id && { id }),
  }
}

const SIGNUP_MODES: SignupMode[] = ['none', 'event', 'session']

/**
 * Turns event frontmatter (or a CMS draft) into an AGEvent, filling defaults.
 * The result only contains JSON-serializable values so it can be used as page props.
 */
export const normalizeEvent = (raw: Raw): AGEvent => {
  const sessions = asRecords(raw.sessions)
    .flatMap((s) => normalizeSession(s) ?? [])
    .sort((a, b) => eventMoment(a.start).valueOf() - eventMoment(b.start).valueOf())
  const albumID = asString(raw.albumID)
  const recordings = asRecords(raw.recordings).flatMap((r) => {
    const url = asString(r.url)
    return url ? [{ name: asString(r.name) || 'Recording', url }] : []
  })

  return {
    name: asString(raw.name) || 'Untitled event',
    image: asString(raw.image) || DEFAULT_EVENT_IMAGE,
    sessions,
    signupMode: SIGNUP_MODES.find((m) => m === raw.signupMode) || 'none',
    visibleOnCalendar: raw.visibleOnCalendar !== false,
    visibleOnEventsPage: raw.visibleOnEventsPage !== false,
    content: typeof raw.content === 'string' ? raw.content : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    slug: asString(raw.slug) || '',
    ...(albumID && { albumID }),
    recordings,
  }
}

/** The first session that hasn't ended yet, or the last one if all have */
export const getRelevantSession = (event: AGEvent, now: Moment = moment()) =>
  event.sessions.find((s) => eventMoment(s.end).isAfter(now)) ??
  event.sessions[event.sessions.length - 1]

/** e.g. "Tue 21.5. 12:00–14:00" or "Fri 16.10. 16:00 – Sat 17.10. 21:00"; the year only if it isn't this one */
export const formatSessionTime = ({ start, end }: EventSession, now: Moment = moment()) => {
  const startMoment = eventMoment(start)
  const endMoment = eventMoment(end)
  const date = (m: Moment) => m.format(m.isSame(now, 'year') ? 'ddd D.M.' : 'ddd D.M.YYYY')
  const startText = `${date(startMoment)} ${startMoment.format('HH:mm')}`
  if (!endMoment.isAfter(startMoment)) return startText
  if (startMoment.isSame(endMoment, 'day')) return `${startText}–${endMoment.format('HH:mm')}`
  return `${startText} – ${date(endMoment)} ${endMoment.format('HH:mm')}`
}

export const formatSignupTime = (time: Moment) => time.format('D.M.YYYY HH:mm')

// Sign-ups

export type SignupTarget = {
  // `eventSlug` for one sign-up for the whole event, `eventSlug:sessionId` for one per session.
  // The slug keeps session ids unique when the CMS duplicates an event.
  key: string
  event: AGEvent
  session?: EventSession
}

export const getSignupTargets = (event: AGEvent): SignupTarget[] => {
  if (event.signupMode === 'event') {
    return [{ key: event.slug, event }]
  }
  if (event.signupMode === 'session') {
    return event.sessions.map((session) => ({
      // Sessions saved by the CMS always have an id; the start time is only a fallback
      key: `${event.slug}:${session.id || eventMoment(session.start).format('YYYYMMDDHHmm')}`,
      event,
      session,
    }))
  }
  return []
}

export const getSignupTargetLabel = ({ event, session }: SignupTarget) =>
  session
    ? `${event.name} - ${session.name || eventMoment(session.start).format('D.M.YYYY')}`
    : event.name

/** The session a sign-up is for, or the event's first one */
export const getSignupTargetStart = ({ event, session }: SignupTarget) =>
  (session ?? event.sessions[0])?.start

export type SignupStatus = 'notOpen' | 'open' | 'closed'

export const getSignupStatus = (
  { openfrom, openuntil }: { openfrom: string; openuntil: string },
  now: Moment = moment()
): SignupStatus => {
  if (now.isBefore(openfrom)) return 'notOpen'
  if (now.isAfter(openuntil)) return 'closed'
  return 'open'
}

// Calendar

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  description: string
  location?: string
  url: string
}

/**
 * Converts AGEvent objects to a calendar-compatible format, one entry per session.
 * Used by both the ICS export and the calendar UI component
 */
export const convertEventsToCalendarFormat = (
  events: AGEvent[],
  addUrl: boolean = true
): CalendarEvent[] => {
  return events
    .filter((event) => event.visibleOnCalendar)
    .flatMap((event) => {
      const url = `https://aaltogamers.fi/events/${event.slug}`
      return event.sessions.map((session, i) => {
        const start = eventMoment(session.start)
        const end = eventMoment(session.end)
        return {
          id: i === 0 ? event.slug : `${event.slug}-${start.format('YYYYMMDDHHmm')}`,
          title: session.name ? `${event.name}: ${session.name}` : event.name,
          start: start.toDate(),
          end: (end.isAfter(start) ? end : start.clone().add(1, 'hour')).toDate(),
          description: event.description + (addUrl ? `\n\n${url}` : ''),
          location: session.location || undefined,
          url,
        }
      })
    })
}
