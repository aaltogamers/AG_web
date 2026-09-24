import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'
import type { SignupInput, SignupPool } from '../../../types/types'
import { normalizePools, publicPools } from '../../../utils/signupPools'

type SignupEventBody = {
  key: string
  pools: SignupPool[]
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
  signup_key: string
  pools: SignupPool[]
  openfrom: Date
  openuntil: Date
  inputs: SignupInput[]
}) => ({
  key: row.signup_key,
  pools: normalizePools(row.pools),
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
      'SELECT signup_key, pools, openfrom, openuntil, inputs FROM signup_events ORDER BY signup_key ASC'
    )
    const events = result.rows.map(rowToSignupEvent)
    const isAdmin = isAdminAuthorized(req)
    return res.status(200).json({
      events: events.map((e) => (isAdmin ? e : { ...e, pools: publicPools(e.pools) })),
    })
  }

  if (req.method === 'POST') {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = parseJsonBody<SignupEventBody>(req)
    if (!body || typeof body.key !== 'string' || !body.key) {
      return res.status(400).json({ error: 'Invalid body' })
    }

    const pools = normalizePools(body.pools)
    const poolNames = pools.map((p) => p.name.toLowerCase())
    if (new Set(poolNames).size !== poolNames.length) {
      return res.status(400).json({ error: 'Pool names must be unique' })
    }
    if (pools.some((p) => p.private && !p.password)) {
      return res.status(400).json({ error: 'Private pools need a password' })
    }

    const inputs = Array.isArray(body.inputs) ? ensureInputIds(body.inputs) : []

    const sql = `
      INSERT INTO signup_events (signup_key, pools, openfrom, openuntil, inputs, updated_at)
      VALUES ($1, $2::jsonb, $3, $4, $5::jsonb, now())
      ON CONFLICT (signup_key) DO UPDATE SET
        pools = EXCLUDED.pools,
        openfrom = EXCLUDED.openfrom,
        openuntil = EXCLUDED.openuntil,
        inputs = EXCLUDED.inputs,
        updated_at = now()
      RETURNING signup_key, pools, openfrom, openuntil, inputs
    `
    const result = await pool.query(sql, [
      body.key,
      JSON.stringify(pools),
      body.openfrom,
      body.openuntil,
      JSON.stringify(inputs),
    ])
    return res.status(200).json({ event: rowToSignupEvent(result.rows[0]) })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
