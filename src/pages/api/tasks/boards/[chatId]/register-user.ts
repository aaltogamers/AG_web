import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../../utils/db_pg'
import { parseJsonBody } from '../../../../../utils/apiUtils'

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

  const chatId = req.query.chatId as string
  const body = parseJsonBody<RegisterBody>(req)

  if (!body || !body.tgUserId || !body.firstName) {
    return res.status(400).json({ error: 'tgUserId and firstName are required' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO tg_users (chat_id, tg_user_id, first_name, last_name, username)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (chat_id, tg_user_id) DO UPDATE
         SET first_name = $3, last_name = $4, username = $5, updated_at = now()
       RETURNING id, chat_id, tg_user_id, first_name, last_name, username`,
      [chatId, body.tgUserId, body.firstName, body.lastName || null, body.username || null]
    )

    await pool.query(
      'DELETE FROM hidden_task_boards WHERE tg_user_id = $1 AND chat_id = $2',
      [body.tgUserId, chatId]
    )

    const row = result.rows[0]
    return res.status(200).json({
      user: {
        id: row.id,
        chatId: row.chat_id,
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
