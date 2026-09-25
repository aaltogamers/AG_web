import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../utils/db_pg'
import { getQueryParam } from '../../utils/apiUtils'
import { normalizePools, publicPools, resolvePoolId } from '../../utils/signupPools'

// An event with a sign-up per session can have dozens of forms
const MAX_KEYS = 200

// Sign-up forms of an event together with how many have signed up to each pool,
// so event pages can show every session's status with one request
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signup-summaries] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const keys = (getQueryParam(req, 'keys') ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, MAX_KEYS)
  if (!keys.length) return res.status(200).json({ summaries: [] })

  const eventsRes = await pool.query(
    'SELECT id, signup_key, pools, openfrom, openuntil, inputs FROM signup_events WHERE signup_key = ANY($1)',
    [keys]
  )
  const countsRes = await pool.query(
    `SELECT event_id, pool_id, COUNT(*)::int AS count FROM signups
     WHERE event_id = ANY($1) GROUP BY event_id, pool_id`,
    [eventsRes.rows.map((row) => row.id)]
  )

  const summaries = eventsRes.rows.map((row) => {
    const pools = normalizePools(row.pools)
    const counts: Record<number, number> = Object.fromEntries(pools.map((p) => [p.id, 0]))
    countsRes.rows
      .filter((c) => c.event_id === row.id)
      .forEach((c) => {
        const poolId = resolvePoolId(pools, c.pool_id)
        counts[poolId] += c.count
      })
    return {
      key: row.signup_key,
      pools: publicPools(pools),
      openfrom: row.openfrom instanceof Date ? row.openfrom.toISOString() : row.openfrom,
      openuntil: row.openuntil instanceof Date ? row.openuntil.toISOString() : row.openuntil,
      inputs: row.inputs,
      counts,
    }
  })

  return res.status(200).json({ summaries })
}
