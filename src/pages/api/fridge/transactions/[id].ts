import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { isAdminAuthorized } from '../../../../utils/adminSession'
import { logFridgeEvent } from '../../../../utils/fridgeLog'

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
    const tx = rows[0]
    const userRes = await pool.query('SELECT name FROM fridge_users WHERE id = $1', [tx.user_id])
    const userName = userRes.rows[0]?.name ?? `user #${tx.user_id}`
    if (tx.type === 'purchase') {
      const itemRes = await pool.query('SELECT name FROM fridge_catalog_items WHERE id = $1', [tx.item_id])
      const itemName = itemRes.rows[0]?.name ?? `item #${tx.item_id}`
      await logFridgeEvent(`Purchase cancelled: ${userName}'s ${tx.quantity}x ${itemName} (${(Math.abs(tx.amount_cents) / 100).toFixed(2)}€)`)
    } else {
      await logFridgeEvent(`Payment cancelled: ${userName}'s payment of ${(tx.amount_cents / 100).toFixed(2)}€`)
    }
    return res.json({ deleted: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
