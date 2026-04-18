import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signup-events/:name] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const rawName = req.query.name
  const name = Array.isArray(rawName) ? rawName[0] : rawName
  if (!name) return res.status(400).json({ error: 'Missing name' })

  if (req.method === 'GET') {
    const result = await pool.query(
      'SELECT name, maxparticipants, openfrom, openuntil, inputs FROM signup_events WHERE name = $1',
      [name]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const row = result.rows[0]
    return res.status(200).json({
      event: {
        name: row.name,
        maxparticipants: row.maxparticipants,
        openfrom:
          row.openfrom instanceof Date ? row.openfrom.toISOString() : row.openfrom,
        openuntil:
          row.openuntil instanceof Date ? row.openuntil.toISOString() : row.openuntil,
        inputs: row.inputs,
      },
    })
  }

  if (req.method === 'DELETE') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    await pool.query('DELETE FROM signup_events WHERE name = $1', [name])
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
