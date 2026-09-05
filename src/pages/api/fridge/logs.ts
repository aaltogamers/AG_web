import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const limit = Math.min(Number(req.query.limit) || 200, 1000)
    const before = req.query.before as string | undefined
    const params: unknown[] = [limit]
    let whereClause = ''
    if (before) {
      whereClause = 'WHERE id < $2'
      params.push(Number(before))
    }
    const { rows } = await pool.query(
      `SELECT id, event, created_at
       FROM fridge_inventory_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1`,
      params
    )
    return res.json({ logs: rows })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
