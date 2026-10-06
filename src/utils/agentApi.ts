// Input parsing helpers for the AI agent MCP server (/api/mcp). See "AI agent
// MCP server" in README.md.
import moment from 'moment-timezone'
import { EVENT_TIMEZONE } from './eventUtils'

// Thrown by tools to answer with an error message the agent can act on
export class AgentError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

export const requireString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AgentError(400, `${name} is required`)
  }
  return value.trim()
}

export const optionalString = (value: unknown, name: string): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new AgentError(400, `${name} must be a string`)
  return value.trim() || undefined
}

export const optionalBoolean = (value: unknown, name: string): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  throw new AgentError(400, `${name} must be true or false`)
}

// Arrays may also come in as JSON strings, depending on how the tool fills them in
export const optionalArray = (value: unknown, name: string): unknown[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new AgentError(400, `${name} must be a JSON array`)
    }
  }
  if (!Array.isArray(parsed)) throw new AgentError(400, `${name} must be an array`)
  return parsed
}

export const asRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentError(400, `${name} must be an object`)
  }
  return value as Record<string, unknown>
}

// The agent works in Helsinki time: times without an offset are Helsinki
// wall-clock times, like the times in event content
export const parseAgentTime = (value: unknown, name: string): moment.Moment => {
  const text = requireString(value, name)
  const hasOffset = /(Z|[+-]\d\d:?\d\d)$/i.test(text)
  const time = hasOffset
    ? moment.parseZone(text, moment.ISO_8601, true)
    : moment.tz(
        text,
        ['YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DDTHH:mm', 'YYYY-MM-DD'],
        true,
        EVENT_TIMEZONE
      )
  if (!time.isValid()) {
    throw new AgentError(400, `${name} must be a time like 2026-10-24T18:00, got "${text}"`)
  }
  return time.tz(EVENT_TIMEZONE)
}

// Helsinki wall-clock time, as used in event content and shown to the agent
export const formatAgentTime = (time: string | Date | moment.Moment) =>
  moment(time).tz(EVENT_TIMEZONE).format('YYYY-MM-DDTHH:mm')
