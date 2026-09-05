import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { isAdminAuthorized } from '../../../../utils/adminSession'
import { parseJsonBody } from '../../../../utils/apiUtils'

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

    params.push(id)
    const { rows } = await pool.query(
      `UPDATE fridge_users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json({ user: rows[0] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
