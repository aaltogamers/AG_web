import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { getHeader, getQueryParam, parseJsonBody } from '../../../utils/apiUtils'
import type { SignupInput } from '../../../types/types'
import {
  describeErrors,
  publicAnswers,
  validateAnswers,
  type AnswerMap,
} from '../../../utils/signupAnswers'
import { prepareImages, saveImages, UploadError } from '../../../utils/signupFiles'
import {
  getPlacement,
  isPoolPasswordValid,
  normalizePools,
  pickPoolId,
  resolvePoolId,
} from '../../../utils/signupPools'

// Room for an image upload in the body, besides the answers
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signups] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const key = getQueryParam(req, 'key')
    if (!key) return res.status(400).json({ error: 'Missing key' })

    const eventRes = await pool.query(
      'SELECT id, inputs, pools, confirmed_message, confirmed_link FROM signup_events WHERE signup_key = $1',
      [key]
    )
    if (eventRes.rows.length === 0) {
      return res.status(200).json({ signups: [] })
    }
    const {
      id: eventId,
      inputs,
      confirmed_message: confirmedMessage,
      confirmed_link: confirmedLink,
    } = eventRes.rows[0] as {
      id: string
      inputs: SignupInput[]
      confirmed_message: string
      confirmed_link: string
    }
    const pools = normalizePools(eventRes.rows[0].pools)

    const signupsRes = await pool.query(
      'SELECT id, pool_id, answers, created_at FROM signups WHERE event_id = $1 ORDER BY created_at ASC',
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
        pool_id: resolvePoolId(pools, row.pool_id),
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        answers: canSeeAll ? answers : publicAnswers(answers, inputs),
      }
    })

    // Only for participants who got a place, not for those on a reserve list
    const placement = ownSignupId && getPlacement(signups, pools, ownSignupId)
    const hasPlace = !!placement && !placement.isReserve

    return res.status(200).json({
      signups,
      ownSignupId,
      ...(hasPlace && confirmedMessage && { confirmedMessage }),
      ...(hasPlace && confirmedLink && { confirmedLink }),
    })
  }

  if (req.method === 'POST') {
    const body = parseJsonBody<{
      key: string
      answers: AnswerMap
      // New images by field id, as data URLs
      files?: Record<string, string>
      poolId?: number
      poolPassword?: string
    }>(req)
    if (!body || typeof body.key !== 'string' || !body.key) {
      return res.status(400).json({ error: 'Invalid body' })
    }
    if (!body.answers || typeof body.answers !== 'object') {
      return res.status(400).json({ error: 'Invalid answers' })
    }

    const eventRes = await pool.query(
      'SELECT id, openfrom, openuntil, pools, inputs FROM signup_events WHERE signup_key = $1',
      [body.key]
    )
    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' })
    }
    const {
      id: eventId,
      openfrom,
      openuntil,
      inputs,
    } = eventRes.rows[0] as {
      id: string
      openfrom: Date
      openuntil: Date
      inputs: SignupInput[]
    }
    const pools = normalizePools(eventRes.rows[0].pools)
    const poolId = pickPoolId(pools, body.poolId)
    if (poolId === null) {
      return res.status(400).json({ error: 'Invalid pool' })
    }
    const chosenPool = pools.find((p) => p.id === poolId)!
    if (!isAdminAuthorized(req) && !isPoolPasswordValid(chosenPool, body.poolPassword)) {
      return res.status(403).json({ error: 'Wrong password' })
    }

    // Admins can sign up outside the sign-up window, e.g. the organizers before it opens
    const now = Date.now()
    if (now < new Date(openfrom).getTime() || now > new Date(openuntil).getTime()) {
      if (!isAdminAuthorized(req)) {
        return res.status(403).json({ error: 'Sign-up not open' })
      }
    }

    let prepared
    try {
      prepared = await prepareImages(inputs, body.answers, body.files, {})
    } catch (err) {
      if (err instanceof UploadError) return res.status(400).json({ error: err.message })
      throw err
    }
    const { answers, errors } = validateAnswers(inputs, prepared.answers)
    const error = describeErrors(inputs, errors)
    if (error) return res.status(400).json({ error, errors })

    const submissionToken = crypto.randomBytes(32).toString('hex')
    const client = await pool.connect()
    let insert
    try {
      await client.query('BEGIN')
      insert = await client.query(
        `INSERT INTO signups (event_id, pool_id, answers, submission_token)
         VALUES ($1, $2, $3::jsonb, $4)
         RETURNING id, created_at`,
        [eventId, poolId, JSON.stringify(answers), submissionToken]
      )
      if (prepared.uploads.size) {
        const id = String(insert.rows[0].id)
        const saved = await saveImages(client, id, inputs, answers, prepared.uploads, {})
        await client.query('UPDATE signups SET answers = $1::jsonb WHERE id = $2', [
          JSON.stringify(saved),
          id,
        ])
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    const row = insert.rows[0]
    return res.status(201).json({
      id: String(row.id),
      submission_token: submissionToken,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
