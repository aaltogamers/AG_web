import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { normalizePools, publicPools } from '../../../utils/signupPools'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signup-events/:key] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const rawKey = req.query.key
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey
  if (!key) return res.status(400).json({ error: 'Missing key' })

  if (req.method === 'GET') {
    const result = await pool.query(
      'SELECT signup_key, pools, openfrom, openuntil, inputs FROM signup_events WHERE signup_key = $1',
      [key]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const row = result.rows[0]
    const pools = normalizePools(row.pools)
    return res.status(200).json({
      event: {
        key: row.signup_key,
        pools: isAdminAuthorized(req) ? pools : publicPools(pools),
        openfrom: row.openfrom instanceof Date ? row.openfrom.toISOString() : row.openfrom,
        openuntil: row.openuntil instanceof Date ? row.openuntil.toISOString() : row.openuntil,
        inputs: row.inputs,
      },
    })
  }

  if (req.method === 'DELETE') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    await pool.query('DELETE FROM signup_events WHERE signup_key = $1', [key])
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
