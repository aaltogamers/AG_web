import type { NextApiRequest, NextApiResponse } from 'next'
import { setAdminSessionCookie, verifyAdminPassword } from '../../../utils/adminSession'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD not configured' })
  }

  const body = req.body as { password?: unknown } | undefined
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!password || !verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  setAdminSessionCookie(res)
  return res.status(204).end()
}
