import type { NextApiRequest, NextApiResponse } from 'next'
import { isAdminAuthorized } from '../../../utils/adminSession'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  return res.status(200).json({ ok: true })
}
