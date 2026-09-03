import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { isAdminAuthorized } from '../../../../utils/adminSession'
import { parseJsonBody } from '../../../../utils/apiUtils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  const id = req.query.id

  if (req.method === 'PATCH') {
    const body = parseJsonBody<{ archived: boolean }>(req)
    if (!body || typeof body.archived !== 'boolean') {
      return res.status(400).json({ error: 'archived (boolean) required' })
    }
    const { rows } = await pool.query(
      `UPDATE fridge_catalog_items SET archived = $1 WHERE id = $2 RETURNING *`,
      [body.archived, id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json({ item: rows[0] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
