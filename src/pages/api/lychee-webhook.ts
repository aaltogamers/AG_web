import type { NextApiRequest, NextApiResponse } from 'next'
import { timingSafeEqualStr } from '../../utils/adminSession'
import { getHeader } from '../../utils/apiUtils'
import { lycheeChanged } from '../../utils/lychee'

// Lychee's webhooks (photo added, moved or deleted): refreshes the albums that the
// event pages link to. Lychee sends LYCHEE_WEBHOOK_SECRET in the x-lychee-secret header.
const handler = (req: NextApiRequest, res: NextApiResponse) => {
  const secret = process.env.LYCHEE_WEBHOOK_SECRET
  const given = getHeader(req, 'x-lychee-secret')
  if (!secret || !given || !timingSafeEqualStr(given, secret)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  lycheeChanged()
  return res.status(200).json({ ok: true })
}

export default handler
