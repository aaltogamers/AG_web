import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { getQueryParam } from '../../../utils/apiUtils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tgUserId = getQueryParam(req, 'tgUserId')
  if (!tgUserId) {
    return res.status(400).json({ error: 'tgUserId is required' })
  }

  const result = await pool.query(
    `SELECT tb.id, tb.chat_id, tb.name, tb.created_at,
            COUNT(t.id)::int AS task_count
     FROM tg_users tu
     JOIN task_boards tb ON tu.chat_id = tb.chat_id
     LEFT JOIN hidden_task_boards htb
       ON htb.tg_user_id = tu.tg_user_id AND htb.chat_id = tu.chat_id
     LEFT JOIN tasks t ON t.board_id = tb.id
     WHERE tu.tg_user_id = $1
       AND htb.tg_user_id IS NULL
     GROUP BY tb.id, tb.chat_id, tb.name, tb.created_at
     ORDER BY tb.name ASC`,
    [tgUserId]
  )

  return res.status(200).json({
    boards: result.rows.map((r) => ({
      id: r.id,
      chatId: r.chat_id,
      name: r.name,
      taskCount: r.task_count,
      createdAt: r.created_at.toISOString(),
    })),
  })
}
