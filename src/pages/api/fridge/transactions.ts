import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'POST') {
    const body = parseJsonBody<{
      user_id: number
      type: 'purchase' | 'payment'
      item_id?: number
      quantity?: number
      amount_cents: number
      message?: string
    }>(req)

    if (!body || !body.user_id || !body.type || typeof body.amount_cents !== 'number') {
      return res.status(400).json({ error: 'user_id, type, and amount_cents required' })
    }

    if (body.type === 'purchase' && (!body.item_id || !body.quantity)) {
      return res.status(400).json({ error: 'item_id and quantity required for purchases' })
    }

    const { rows } = await pool.query(
      `INSERT INTO fridge_transactions (user_id, type, item_id, quantity, amount_cents, message)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.user_id, body.type, body.item_id ?? null, body.quantity ?? null, body.amount_cents, body.message?.trim() || null]
    )
    return res.status(201).json({ transaction: rows[0] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
