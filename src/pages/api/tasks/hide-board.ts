import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { parseJsonBody } from '../../../utils/apiUtils'

type HideBody = {
  tgUserId: string
  chatId: string
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

  const body = parseJsonBody<HideBody>(req)
  if (!body?.tgUserId || !body?.chatId) {
    return res.status(400).json({ error: 'tgUserId and chatId are required' })
  }

  await pool.query(
    `INSERT INTO hidden_task_boards (tg_user_id, chat_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [body.tgUserId, body.chatId]
  )

  return res.status(200).json({ ok: true })
}
