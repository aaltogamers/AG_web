import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../utils/db_pg'
import { getQueryParam } from '../../utils/apiUtils'
import { publicPools } from '../../utils/signupPools'
import { getSignupSummaries } from '../../utils/signupForms'

// An event with a sign-up per session can have dozens of forms
const MAX_KEYS = 200

// Sign-up forms of an event together with how many have signed up to each pool,
// so event pages can show every session's status with one request
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signup-summaries] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const keys = (getQueryParam(req, 'keys') ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, MAX_KEYS)

  const summaries = await getSignupSummaries(keys)
  return res.status(200).json({
    summaries: summaries.map((s) => ({ ...s, pools: publicPools(s.pools) })),
  })
}
