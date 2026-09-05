import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'
import { logFridgeEvent } from '../../../utils/fridgeLog'

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.photo, u.created_at,
              COALESCE(SUM(t.amount_cents), 0)::int AS balance_cents
       FROM fridge_users u
       LEFT JOIN fridge_transactions t ON t.user_id = u.id
       GROUP BY u.id
       ORDER BY u.name ASC`
    )
    return res.json({ users: rows })
  }

  if (req.method === 'POST') {
    const body = parseJsonBody<{ name: string; photo?: string }>(req)
    if (!body || !body.name) {
      return res.status(400).json({ error: 'name required' })
    }
    const { rows } = await pool.query(
      `INSERT INTO fridge_users (name, photo) VALUES ($1, $2) RETURNING *`,
      [body.name, body.photo ?? null]
    )
    await logFridgeEvent(`User created: "${body.name}"`)
    return res.json({ user: rows[0] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
