import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../../utils/db_pg'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const chatId = req.query.chatId as string
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  try {
    let result
    if (q) {
      const pattern = `%${q}%`
      result = await pool.query(
        `SELECT id, chat_id, tg_user_id, first_name, last_name, username
         FROM tg_users
         WHERE chat_id = $1
           AND (
             tg_user_id ILIKE $2
             OR first_name ILIKE $2
             OR last_name ILIKE $2
             OR username ILIKE $2
           )
         ORDER BY first_name ASC
         LIMIT 20`,
        [chatId, pattern]
      )
    } else {
      result = await pool.query(
        `SELECT id, chat_id, tg_user_id, first_name, last_name, username
         FROM tg_users
         WHERE chat_id = $1
         ORDER BY first_name ASC
         LIMIT 20`,
        [chatId]
      )
    }

    const users = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      chatId: row.chat_id,
      tgUserId: row.tg_user_id,
      firstName: row.first_name,
      lastName: row.last_name ?? undefined,
      username: row.username ?? undefined,
    }))

    return res.status(200).json({ users })
  } catch (err) {
    console.error('[users] search failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
