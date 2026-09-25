// Sign-up form database access shared by the admin API (/api/signup-events,
// /api/signup-summaries) and the AI agent API (/api/agent/signup-forms).
// Never returns participants' answers.
import pool from './db_pg'
import type { SignupInput, SignupPool, SignUpData } from '../types/types'
import type { SignupEvent, SignupSummary } from './signupApi'
import { normalizePools, resolvePoolId } from './signupPools'

type SignupEventRow = {
  signup_key: string
  pools: SignupPool[]
  openfrom: Date
  openuntil: Date
  inputs: SignupInput[]
}

const toISO = (d: Date | string) => (d instanceof Date ? d.toISOString() : d)

const rowToSignupEvent = (row: SignupEventRow): SignupEvent => ({
  key: row.signup_key,
  pools: normalizePools(row.pools),
  openfrom: toISO(row.openfrom),
  openuntil: toISO(row.openuntil),
  inputs: row.inputs,
})

// Ensure every input has a stable numeric id. Defaults to max+1 for new items,
// but any id the admin passes through is preserved.
const ensureInputIds = (inputs: SignupInput[]): SignupInput[] => {
  let maxId = 0
  inputs.forEach((input) => {
    const id = Number(input?.id)
    if (Number.isFinite(id) && id > maxId) maxId = id
  })
  return inputs.map((input) => {
    const id = Number(input?.id)
    if (Number.isFinite(id) && id > 0) {
      return { ...input, id }
    }
    maxId += 1
    return { ...input, id: maxId }
  })
}

export const listSignupForms = async (): Promise<SignupEvent[]> => {
  const result = await pool.query<SignupEventRow>(
    'SELECT signup_key, pools, openfrom, openuntil, inputs FROM signup_events ORDER BY signup_key ASC'
  )
  return result.rows.map(rowToSignupEvent)
}

export const getSignupForm = async (key: string): Promise<SignupEvent | null> => {
  const result = await pool.query<SignupEventRow>(
    'SELECT signup_key, pools, openfrom, openuntil, inputs FROM signup_events WHERE signup_key = $1',
    [key]
  )
  return result.rows[0] ? rowToSignupEvent(result.rows[0]) : null
}

// Creates the form, or replaces it if one with the same key exists.
// Returns an error message if the data is invalid.
export const saveSignupForm = async (
  data: SignUpData
): Promise<{ event: SignupEvent } | { error: string }> => {
  const pools = normalizePools(data.pools)
  const poolNames = pools.map((p) => p.name.toLowerCase())
  if (new Set(poolNames).size !== poolNames.length) {
    return { error: 'Pool names must be unique' }
  }
  if (pools.some((p) => p.private && !p.password)) {
    return { error: 'Private pools need a password' }
  }
  const openfrom = new Date(data.openfrom)
  const openuntil = new Date(data.openuntil)
  if (isNaN(openfrom.getTime()) || isNaN(openuntil.getTime())) {
    return { error: 'Invalid open from / open until time' }
  }

  const inputs = Array.isArray(data.inputs) ? ensureInputIds(data.inputs) : []

  const result = await pool.query<SignupEventRow>(
    `INSERT INTO signup_events (signup_key, pools, openfrom, openuntil, inputs, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, $5::jsonb, now())
     ON CONFLICT (signup_key) DO UPDATE SET
       pools = EXCLUDED.pools,
       openfrom = EXCLUDED.openfrom,
       openuntil = EXCLUDED.openuntil,
       inputs = EXCLUDED.inputs,
       updated_at = now()
     RETURNING signup_key, pools, openfrom, openuntil, inputs`,
    [data.key, JSON.stringify(pools), openfrom, openuntil, JSON.stringify(inputs)]
  )
  return { event: rowToSignupEvent(result.rows[0]) }
}

// Deletes forms together with all their sign-ups
export const deleteSignupForms = async (keys: string[]): Promise<void> => {
  if (!keys.length) return
  await pool.query('DELETE FROM signup_events WHERE signup_key = ANY($1)', [keys])
}

// Forms with the number of sign-ups in each pool. Pools include passwords;
// strip them with publicPools before showing them to non-admins.
export const getSignupSummaries = async (keys: string[]): Promise<SignupSummary[]> => {
  if (!keys.length) return []
  const eventsRes = await pool.query<SignupEventRow & { id: string }>(
    'SELECT id, signup_key, pools, openfrom, openuntil, inputs FROM signup_events WHERE signup_key = ANY($1)',
    [keys]
  )
  const countsRes = await pool.query<{ event_id: string; pool_id: number; count: number }>(
    `SELECT event_id, pool_id, COUNT(*)::int AS count FROM signups
     WHERE event_id = ANY($1) GROUP BY event_id, pool_id`,
    [eventsRes.rows.map((row) => row.id)]
  )

  return eventsRes.rows.map((row) => {
    const event = rowToSignupEvent(row)
    const counts: Record<number, number> = Object.fromEntries(event.pools.map((p) => [p.id, 0]))
    countsRes.rows
      .filter((c) => c.event_id === row.id)
      .forEach((c) => {
        counts[resolvePoolId(event.pools, c.pool_id)] += c.count
      })
    return { ...event, counts }
  })
}

// Keys of every form belonging to an event: `slug` and `slug:<sessionId>`,
// including forms of sessions that have since been removed
export const getSignupFormKeysOfEvent = async (slug: string): Promise<string[]> => {
  const result = await pool.query<{ signup_key: string }>(
    `SELECT signup_key FROM signup_events
     WHERE signup_key = $1 OR left(signup_key, length($1) + 1) = $1 || ':'`,
    [slug]
  )
  return result.rows.map((r) => r.signup_key)
}

export const totalSignups = (summary: SignupSummary): number =>
  Object.values(summary.counts).reduce((sum, n) => sum + n, 0)
