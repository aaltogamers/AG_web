import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { parseJsonBody } from '../../../../utils/apiUtils'

type ResolveBody = {
  tgUserId: string
  chatId?: string
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

  const body = parseJsonBody<ResolveBody>(req)

  if (!body || !body.tgUserId) {
    return res.status(400).json({ error: 'tgUserId is required' })
  }

  try {
    const existing = await pool.query(
      `SELECT id, tg_user_id, first_name, last_name, username
       FROM tg_users
       WHERE tg_user_id = $1`,
      [body.tgUserId]
    )

    if (existing.rows.length > 0) {
      const row = existing.rows[0]
      return res.status(200).json({
        user: {
          id: row.id,
          tgUserId: row.tg_user_id,
          firstName: row.first_name,
          lastName: row.last_name ?? undefined,
          username: row.username ?? undefined,
        },
      })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken || !body.chatId) {
      return res.status(404).json({ error: 'User not found' })
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: body.chatId, user_id: Number(body.tgUserId) }),
        signal: AbortSignal.timeout(5000),
      }
    )

    if (!tgRes.ok) {
      return res.status(404).json({ error: 'User not found' })
    }

    const tgData = await tgRes.json()
    if (!tgData.ok || !tgData.result?.user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const tgUser = tgData.result.user
    const result = await pool.query(
      `INSERT INTO tg_users (tg_user_id, first_name, last_name, username)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tg_user_id) DO UPDATE
         SET first_name = $2, last_name = $3, username = $4, updated_at = now()
       RETURNING id, tg_user_id, first_name, last_name, username`,
      [
        String(tgUser.id),
        tgUser.first_name,
        tgUser.last_name || null,
        tgUser.username || null,
      ]
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
    console.error('[resolve-user] failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
