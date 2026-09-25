import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../../../utils/db_pg'
import { searchTaskUsers } from '../../../../utils/taskStore'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  try {
    return res.status(200).json({ users: await searchTaskUsers(q) })
  } catch (err) {
    console.error('[users] search failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
