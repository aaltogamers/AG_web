import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../../utils/db_pg'
import { isAdminAuthorized } from '../../../../../utils/adminSession'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const userId = req.query.id
    const { rows } = await pool.query(
      `SELECT t.id, t.type, t.item_id, t.quantity, t.amount_cents, t.message, t.created_at,
              i.name AS item_name
       FROM fridge_transactions t
       LEFT JOIN fridge_catalog_items i ON i.id = t.item_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [userId]
    )
    return res.json({ transactions: rows })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
