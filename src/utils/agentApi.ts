// Helpers for the AI agent API (/api/agent/**), which is meant to be called as
// tools from n8n. See "AI agent API" in README.md.
import type { NextApiRequest, NextApiResponse } from 'next'
import moment from 'moment-timezone'
import { ensureMigrated } from './db_pg'
import { timingSafeEqualStr } from './adminSession'
import { getHeader } from './apiUtils'
import { EVENT_TIMEZONE } from './eventUtils'

// Thrown by handlers to answer with an error message the agent can act on
export class AgentError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

// `Authorization: Bearer <AGENT_API_KEY>`. The agent API is disabled if the key isn't set.
const isAgentAuthorized = (req: NextApiRequest): boolean => {
  const key = process.env.AGENT_API_KEY
  const header = getHeader(req, 'authorization')
  if (!key || !header?.startsWith('Bearer ')) return false
  return timingSafeEqualStr(header.slice('Bearer '.length).trim(), key)
}

type Handlers = Partial<
  Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', (req: NextApiRequest) => Promise<unknown>>
>

// Checks the key, runs the handler for the method and answers with its result as JSON
export const agentHandler =
  (handlers: Handlers) => async (req: NextApiRequest, res: NextApiResponse) => {
    if (!isAgentAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const handle = handlers[req.method as keyof Handlers]
    if (!handle) return res.status(405).json({ error: 'Method not allowed' })
    try {
      await ensureMigrated()
      return res.status(200).json(await handle(req))
    } catch (err) {
      if (err instanceof AgentError) return res.status(err.status).json({ error: err.message })
      console.error(`[agent] ${req.method} ${req.url} failed:`, err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }

export const getBody = (req: NextApiRequest): Record<string, unknown> => {
  let body = req.body
  // A JSON object may also come in as a JSON string, e.g. when an LLM fills a json tool parameter
  for (let i = 0; i < 2 && typeof body === 'string'; i++) {
    try {
      body = JSON.parse(body)
    } catch {
      throw new AgentError(400, 'Body must be JSON')
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AgentError(400, 'Body must be a JSON object')
  }
  return body as Record<string, unknown>
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
