import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'

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
      `SELECT id, name, price_cents, photo, archived, sort_order, created_at
       FROM fridge_catalog_items ORDER BY sort_order ASC, created_at ASC`
    )
    return res.json({ items: rows })
  }

  if (req.method === 'POST') {
    const body = parseJsonBody<{ name: string; price_cents: number; photo?: string }>(req)
    if (!body || !body.name || typeof body.price_cents !== 'number') {
      return res.status(400).json({ error: 'name and price_cents required' })
    }
    const { rows } = await pool.query(
      `INSERT INTO fridge_catalog_items (name, price_cents, photo)
       VALUES ($1, $2, $3) RETURNING *`,
      [body.name, body.price_cents, body.photo ?? null]
    )
    return res.status(201).json({ item: rows[0] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
