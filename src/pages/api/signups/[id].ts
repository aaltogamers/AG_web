import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { getHeader, parseJsonBody } from '../../../utils/apiUtils'
import type { DataValue } from '../../../types/types'

type AnswerMap = Record<string, DataValue>

const timingSafeEqualStr = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

const canAct = async (
  req: NextApiRequest,
  signupId: string
): Promise<{ ok: boolean; isAdmin: boolean }> => {
  const isAdmin = isAdminAuthorized(req)
  if (isAdmin) return { ok: true, isAdmin }
  const submissionToken = getHeader(req, 'x-submission-token')
  if (!submissionToken) return { ok: false, isAdmin }
  const res = await pool.query('SELECT submission_token FROM signups WHERE id = $1', [
    signupId,
  ])
  if (res.rows.length === 0) return { ok: false, isAdmin }
  const stored = res.rows[0].submission_token as string
  return { ok: timingSafeEqualStr(stored, submissionToken), isAdmin }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signups/:id] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const rawId = req.query.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (!id) return res.status(400).json({ error: 'Missing id' })

  if (req.method === 'GET') {
    const { ok } = await canAct(req, id)
    if (!ok) return res.status(401).json({ error: 'Unauthorized' })
    const result = await pool.query(
      'SELECT id, answers, created_at FROM signups WHERE id = $1',
      [id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const row = result.rows[0]
    return res.status(200).json({
      id: String(row.id),
      answers: row.answers,
      created_at:
        row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    })
  }

  if (req.method === 'PUT') {
    const { ok } = await canAct(req, id)
    if (!ok) return res.status(401).json({ error: 'Unauthorized' })
    const body = parseJsonBody<{ answers: AnswerMap }>(req)
    if (!body || typeof body.answers !== 'object') {
      return res.status(400).json({ error: 'Invalid body' })
    }
    await pool.query('UPDATE signups SET answers = $1::jsonb WHERE id = $2', [
      JSON.stringify(body.answers),
      id,
    ])
    return res.status(204).end()
  }

  if (req.method === 'DELETE') {
    const { ok } = await canAct(req, id)
    if (!ok) return res.status(401).json({ error: 'Unauthorized' })
    await pool.query('DELETE FROM signups WHERE id = $1', [id])
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
