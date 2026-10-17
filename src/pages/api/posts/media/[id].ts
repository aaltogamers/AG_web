import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../../../utils/db_pg'
import { postImageUrl } from '../../../../utils/mediaStore'
import { getMedia } from '../../../../utils/postStore'

// Public: an uploaded post image. Redirects to its file; kept for links already sent.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end()
  await ensureMigrated()
  const id = String(req.query.id ?? '')
  if (!(await getMedia(id))) return res.status(404).end()
  return res.redirect(308, postImageUrl(id))
}
