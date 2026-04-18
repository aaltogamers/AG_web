import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { getHeader, getQueryParam, parseJsonBody } from '../../../utils/apiUtils'
import type { DataValue, SignupInput } from '../../../types/types'

type AnswerMap = Record<string, DataValue>

const publicFieldIds = (inputs: SignupInput[]): Set<string> => {
  const ids = new Set<string>()
  inputs.forEach((input) => {
    if (input.public) ids.add(String(input.id))
  })
  return ids
}

const filterPublicAnswers = (
  answers: AnswerMap,
  inputs: SignupInput[]
): AnswerMap => {
  const publicIds = publicFieldIds(inputs)
  const out: AnswerMap = {}
  Object.entries(answers).forEach(([k, v]) => {
    if (publicIds.has(k)) out[k] = v
  })
  return out
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signups] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const eventName = getQueryParam(req, 'event')
    if (!eventName) return res.status(400).json({ error: 'Missing event' })

    const eventRes = await pool.query(
      'SELECT id, inputs FROM signup_events WHERE name = $1',
      [eventName]
    )
    if (eventRes.rows.length === 0) {
      return res.status(200).json({ signups: [] })
    }
    const { id: eventId, inputs } = eventRes.rows[0] as {
      id: string
      inputs: SignupInput[]
    }

    const signupsRes = await pool.query(
      'SELECT id, answers, created_at FROM signups WHERE event_id = $1 ORDER BY created_at ASC',
      [eventId]
    )

    const submissionToken = getHeader(req, 'x-submission-token')
    const isAdmin = isAdminAuthorized(req)

    // Admins can see everything, but they can still have their own signup as a
    // participant — look up ownSignupId whenever a token is presented.
    let ownSignupId: string | null = null
    if (submissionToken) {
      const ownRes = await pool.query(
        'SELECT id FROM signups WHERE event_id = $1 AND submission_token = $2',
        [eventId, submissionToken]
      )
      ownSignupId = ownRes.rows[0] ? String(ownRes.rows[0].id) : null
    }

    const signups = signupsRes.rows.map((row) => {
      const id = String(row.id)
      const answers = (row.answers ?? {}) as AnswerMap
      const canSeeAll = isAdmin || id === ownSignupId
      return {
        id,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
        answers: canSeeAll ? answers : filterPublicAnswers(answers, inputs),
      }
    })

    return res.status(200).json({ signups, ownSignupId })
  }

  if (req.method === 'POST') {
    const body = parseJsonBody<{ event: string; answers: AnswerMap }>(req)
    if (!body || typeof body.event !== 'string' || !body.event) {
      return res.status(400).json({ error: 'Invalid body' })
    }
    if (!body.answers || typeof body.answers !== 'object') {
      return res.status(400).json({ error: 'Invalid answers' })
    }

    const eventRes = await pool.query(
      'SELECT id, openfrom, openuntil FROM signup_events WHERE name = $1',
      [body.event]
    )
    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' })
    }
    const { id: eventId, openfrom, openuntil } = eventRes.rows[0] as {
      id: string
      openfrom: Date
      openuntil: Date
    }

    // Signup window enforcement (admins still blocked here; they edit via PUT).
    const now = Date.now()
    if (now < new Date(openfrom).getTime() || now > new Date(openuntil).getTime()) {
      if (!isAdminAuthorized(req)) {
        return res.status(403).json({ error: 'Sign-up not open' })
      }
    }

    const submissionToken = crypto.randomBytes(32).toString('hex')
    const insert = await pool.query(
      `INSERT INTO signups (event_id, answers, submission_token)
       VALUES ($1, $2::jsonb, $3)
       RETURNING id, created_at`,
      [eventId, JSON.stringify(body.answers), submissionToken]
    )
    const row = insert.rows[0]
    return res.status(201).json({
      id: String(row.id),
      submission_token: submissionToken,
      created_at:
        row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
