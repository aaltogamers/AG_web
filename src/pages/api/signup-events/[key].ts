import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { publicPools } from '../../../utils/signupPools'
import { deleteSignupForms, getSignupForm } from '../../../utils/signupForms'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[signup-events/:key] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const rawKey = req.query.key
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey
  if (!key) return res.status(400).json({ error: 'Missing key' })

  if (req.method === 'GET') {
    const event = await getSignupForm(key)
    if (!event) return res.status(404).json({ error: 'Not found' })
    return res.status(200).json({
      event: isAdminAuthorized(req) ? event : { ...event, pools: publicPools(event.pools) },
    })
  }

  if (req.method === 'DELETE') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    await deleteSignupForms([key])
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
