import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'
import type { SignUpData } from '../../../types/types'
import { publicPools } from '../../../utils/signupPools'
import { listSignupForms, saveSignupForm } from '../../../utils/signupForms'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signup-events] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const events = await listSignupForms()
    const isAdmin = isAdminAuthorized(req)
    return res.status(200).json({
      events: events.map((e) => (isAdmin ? e : { ...e, pools: publicPools(e.pools) })),
    })
  }

  if (req.method === 'POST') {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = parseJsonBody<SignUpData>(req)
    if (!body || typeof body.key !== 'string' || !body.key) {
      return res.status(400).json({ error: 'Invalid body' })
    }

    const result = await saveSignupForm(body)
    if ('error' in result) return res.status(400).json(result)
    return res.status(200).json(result)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
