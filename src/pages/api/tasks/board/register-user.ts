import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { parseJsonBody } from '../../../../utils/apiUtils'

type RegisterBody = {
  tgUserId: string
  firstName: string
  lastName?: string
  username?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = parseJsonBody<RegisterBody>(req)

  if (!body || !body.tgUserId || !body.firstName) {
    return res.status(400).json({ error: 'tgUserId and firstName are required' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO tg_users (tg_user_id, first_name, last_name, username)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tg_user_id) DO UPDATE
         SET first_name = $2, last_name = $3, username = $4, updated_at = now()
       RETURNING id, tg_user_id, first_name, last_name, username`,
      [body.tgUserId, body.firstName, body.lastName || null, body.username || null]
    )

    const row = result.rows[0]
    return res.status(200).json({
      user: {
        id: row.id,
        tgUserId: row.tg_user_id,
        firstName: row.first_name,
        lastName: row.last_name ?? undefined,
        username: row.username ?? undefined,
      },
    })
  } catch (err) {
    console.error('[register-user] failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
