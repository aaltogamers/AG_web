import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'
import type { SignupInput } from '../../../types/types'

type SignupEventBody = {
  name: string
  maxparticipants: number | string
  openfrom: string
  openuntil: string
  inputs: SignupInput[]
}

// Ensure every input has a stable numeric id. Defaults to max+1 for new items,
// but any id the admin passes through is preserved.
const ensureInputIds = (inputs: SignupInput[]): SignupInput[] => {
  let maxId = 0
  inputs.forEach((input) => {
    const id = Number(input?.id)
    if (Number.isFinite(id) && id > maxId) maxId = id
  })
  return inputs.map((input) => {
    const id = Number(input?.id)
    if (Number.isFinite(id) && id > 0) {
      return { ...input, id }
    }
    maxId += 1
    return { ...input, id: maxId }
  })
}

const rowToSignupEvent = (row: {
  name: string
  maxparticipants: number
  openfrom: Date
  openuntil: Date
  inputs: SignupInput[]
}) => ({
  name: row.name,
  maxparticipants: row.maxparticipants,
  openfrom: row.openfrom instanceof Date ? row.openfrom.toISOString() : row.openfrom,
  openuntil: row.openuntil instanceof Date ? row.openuntil.toISOString() : row.openuntil,
  inputs: row.inputs,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signup-events] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const result = await pool.query(
      'SELECT name, maxparticipants, openfrom, openuntil, inputs FROM signup_events ORDER BY name ASC'
    )
    return res.status(200).json({ events: result.rows.map(rowToSignupEvent) })
  }

  if (req.method === 'POST') {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = parseJsonBody<SignupEventBody>(req)
    if (!body || typeof body.name !== 'string' || !body.name) {
      return res.status(400).json({ error: 'Invalid body' })
    }

    const maxparticipants =
      typeof body.maxparticipants === 'number'
        ? body.maxparticipants
        : parseInt(String(body.maxparticipants), 10) || 0

    const inputs = Array.isArray(body.inputs) ? ensureInputIds(body.inputs) : []

    const sql = `
      INSERT INTO signup_events (name, maxparticipants, openfrom, openuntil, inputs, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
      ON CONFLICT (name) DO UPDATE SET
        maxparticipants = EXCLUDED.maxparticipants,
        openfrom = EXCLUDED.openfrom,
        openuntil = EXCLUDED.openuntil,
        inputs = EXCLUDED.inputs,
        updated_at = now()
      RETURNING name, maxparticipants, openfrom, openuntil, inputs
    `
    const result = await pool.query(sql, [
      body.name,
      maxparticipants,
      body.openfrom,
      body.openuntil,
      JSON.stringify(inputs),
    ])
    return res.status(200).json({ event: rowToSignupEvent(result.rows[0]) })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
