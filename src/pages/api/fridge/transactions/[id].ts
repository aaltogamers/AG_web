import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { isAdminAuthorized } from '../../../../utils/adminSession'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  const id = req.query.id

  if (req.method === 'DELETE') {
    const { rows } = await pool.query(
      `DELETE FROM fridge_transactions
       WHERE id = $1
         AND created_at > NOW() - INTERVAL '120 seconds'
       RETURNING *`,
      [id]
    )
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Transaction not found or cancel window expired' })
    }
    return res.json({ deleted: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
