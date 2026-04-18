import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { getHeader, getQueryParam, parseJsonBody } from '../../../utils/apiUtils'
import { publish } from '../../../utils/bus'

const timingSafeEqualStr = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

const verifyBotSecret = (req: NextApiRequest): boolean => {
  const expected = process.env.BET_BOT_SECRET
  if (!expected) return false
  const provided = getHeader(req, 'x-bet-secret')
  if (!provided) return false
  return timingSafeEqualStr(provided, expected)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[votes] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const pollId = getQueryParam(req, 'poll')
    if (pollId) {
      const result = await pool.query(
        `SELECT id, poll_id, picked_option, user_name, points
         FROM votes WHERE poll_id = $1 ORDER BY created_at ASC`,
        [pollId]
      )
      return res.status(200).json({
        votes: result.rows.map((r) => ({
          id: String(r.id),
          poll: String(r.poll_id),
          pickedOption: r.picked_option,
          user: r.user_name,
          points: r.points ?? undefined,
        })),
      })
    }

    const result = await pool.query(
      `SELECT id, poll_id, picked_option, user_name, points
       FROM votes ORDER BY created_at ASC`
    )
    return res.status(200).json({
      votes: result.rows.map((r) => ({
        id: String(r.id),
        poll: String(r.poll_id),
        pickedOption: r.picked_option,
        user: r.user_name,
        points: r.points ?? undefined,
      })),
    })
  }

  if (req.method === 'POST') {
    if (!verifyBotSecret(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = parseJsonBody<{ poll: string; pickedOption: string; user: string }>(req)
    if (
      !body ||
      typeof body.poll !== 'string' ||
      typeof body.pickedOption !== 'string' ||
      typeof body.user !== 'string' ||
      !body.user
    ) {
      return res.status(400).json({ error: 'Invalid body' })
    }

    const pollRes = await pool.query(
      `SELECT options, is_votable FROM polls WHERE id = $1`,
      [body.poll]
    )
    if (pollRes.rows.length === 0) return res.status(404).json({ error: 'Poll not found' })
    const poll = pollRes.rows[0] as { options: string[]; is_votable: boolean }
    if (!poll.is_votable) return res.status(403).json({ error: 'Betting closed' })
    if (!poll.options.includes(body.pickedOption)) {
      return res.status(400).json({ error: 'Invalid option' })
    }

    await pool.query(
      `INSERT INTO votes (poll_id, picked_option, user_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (poll_id, user_name) DO UPDATE SET picked_option = EXCLUDED.picked_option`,
      [body.poll, body.pickedOption, body.user]
    )
    publish('votes')
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
