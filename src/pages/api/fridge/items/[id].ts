import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { isAdminAuthorized } from '../../../../utils/adminSession'
import { parseJsonBody } from '../../../../utils/apiUtils'
import { logFridgeEvent } from '../../../../utils/fridgeLog'

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  const id = req.query.id

  if (req.method === 'PATCH') {
    const body = parseJsonBody<{ archived?: boolean; photo?: string | null; name?: string }>(req)
    if (!body) return res.status(400).json({ error: 'Invalid body' })

    const sets: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (typeof body.archived === 'boolean') {
      sets.push(`archived = $${idx++}`)
      params.push(body.archived)
    }
    if ('photo' in body) {
      sets.push(`photo = $${idx++}`)
      params.push(body.photo ?? null)
    }
    if (typeof body.name === 'string' && body.name.trim()) {
      sets.push(`name = $${idx++}`)
      params.push(body.name.trim())
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' })

    const { rows: oldRows } = await pool.query(
      'SELECT name, photo, archived FROM fridge_catalog_items WHERE id = $1', [id]
    )
    if (oldRows.length === 0) return res.status(404).json({ error: 'Not found' })
    const old = oldRows[0]

    params.push(id)
    const { rows } = await pool.query(
      `UPDATE fridge_catalog_items SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    )
    const item = rows[0]
    const changes: string[] = []
    if (typeof body.archived === 'boolean') changes.push(body.archived ? 'archived' : 'unarchived')
    if (typeof body.name === 'string') changes.push(`name: "${old.name}" → "${body.name.trim()}"`)
    if ('photo' in body) changes.push(body.photo ? 'photo updated' : 'photo removed')
    await logFridgeEvent(`Item updated: "${old.name}" (${changes.join(', ')})`)
    return res.json({ item })
  }

  if (req.method === 'DELETE') {
    const { rows: deleted } = await pool.query(
      `DELETE FROM fridge_catalog_items WHERE id = $1 RETURNING name`,
      [id]
    )
    if (deleted.length === 0) return res.status(404).json({ error: 'Not found' })
    await logFridgeEvent(`Item deleted: "${deleted[0].name}"`)
    return res.json({ deleted: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
