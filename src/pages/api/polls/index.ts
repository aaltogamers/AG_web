import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'
import { publish } from '../../../utils/bus'

type PollRow = {
  id: string
  question: string
  options: string[]
  is_visible: boolean
  is_votable: boolean
  correct_option: string | null
  points_for_win: number | null
  additional_message: string | null
  created_at: Date
}

const rowToPoll = (r: PollRow) => ({
  id: String(r.id),
  question: r.question,
  options: r.options,
  isVisible: r.is_visible,
  isVotable: r.is_votable,
  correctOption: r.correct_option ?? undefined,
  pointsForWin: r.points_for_win ?? undefined,
  additionalMessage: r.additional_message ?? undefined,
  creationTimeStamp:
    r.created_at instanceof Date ? r.created_at.getTime() : new Date(r.created_at).getTime(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[polls] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const result = await pool.query(
      `SELECT id, question, options, is_visible, is_votable, correct_option,
              points_for_win, additional_message, created_at
       FROM polls ORDER BY created_at ASC`
    )
    return res.status(200).json({ polls: result.rows.map((r: PollRow) => rowToPoll(r)) })
  }

  if (req.method === 'POST') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const body = parseJsonBody<{
      question: string
      options: string[]
      additionalMessage?: string
    }>(req)
    if (
      !body ||
      typeof body.question !== 'string' ||
      !body.question ||
      !Array.isArray(body.options) ||
      body.options.length === 0
    ) {
      return res.status(400).json({ error: 'Invalid body' })
    }

    const result = await pool.query(
      `INSERT INTO polls (question, options, additional_message)
       VALUES ($1, $2, $3)
       RETURNING id, question, options, is_visible, is_votable, correct_option,
                 points_for_win, additional_message, created_at`,
      [body.question, body.options, body.additionalMessage ?? null]
    )
    publish('polls')
    return res.status(201).json({ poll: rowToPoll(result.rows[0]) })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
