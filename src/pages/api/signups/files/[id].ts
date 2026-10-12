import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../../../utils/db_pg'
import { getSignupFile } from '../../../../utils/signupFiles'

// An image uploaded with a sign-up. Its id is only sent to those who can see the
// answer (admins, the participant, and everyone if the field is public).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end()
  await ensureMigrated()
  const file = await getSignupFile(String(req.query.id ?? ''))
  if (!file) return res.status(404).end()
  res.setHeader('Content-Type', file.content_type)
  // A new upload gets a new id, so a file never changes
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  return res.status(200).send(file.data)
}
