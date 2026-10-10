import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../../../utils/db_pg'
import { getMedia } from '../../../../utils/postStore'

// Public: an uploaded post image. Instagram fetches post images from here.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end()
  await ensureMigrated()
  const id = String(req.query.id ?? '')
  const media = await getMedia(id)
  if (!media) return res.status(404).end()
  res.setHeader('Content-Type', media.content_type)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  return res.status(200).send(media.data)
}
