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

  if (req.method === 'PUT') {
    const body = parseJsonBody<{ order: number[] }>(req)
    if (!body?.order || !Array.isArray(body.order)) {
      return res.status(400).json({ error: 'order array required' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (let i = 0; i < body.order.length; i++) {
        await client.query(
          'UPDATE fridge_catalog_items SET sort_order = $1 WHERE id = $2',
          [i, body.order[i]]
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return res.json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
