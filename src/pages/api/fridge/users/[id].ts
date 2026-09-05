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
    const body = parseJsonBody<{ name?: string; photo?: string | null }>(req)
    if (!body) return res.status(400).json({ error: 'Invalid body' })

    const sets: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (typeof body.name === 'string' && body.name.trim()) {
      sets.push(`name = $${idx++}`)
      params.push(body.name.trim())
    }
    if ('photo' in body) {
      sets.push(`photo = $${idx++}`)
      params.push(body.photo ?? null)
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' })

    const { rows: oldRows } = await pool.query(
      'SELECT name, photo FROM fridge_users WHERE id = $1', [id]
    )
    if (oldRows.length === 0) return res.status(404).json({ error: 'Not found' })
    const old = oldRows[0]

    params.push(id)
    const { rows } = await pool.query(
      `UPDATE fridge_users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    )
    const user = rows[0]
    const changes: string[] = []
    if (typeof body.name === 'string') changes.push(`name: "${old.name}" → "${body.name.trim()}"`)
    if ('photo' in body) changes.push(body.photo ? 'photo updated' : 'photo removed')
    await logFridgeEvent(`User updated: "${old.name}" (${changes.join(', ')})`)
    return res.json({ user })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
