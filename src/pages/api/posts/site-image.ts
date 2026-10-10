import type { NextApiRequest, NextApiResponse } from 'next'
import { AgentError } from '../../../utils/agentApi'
import { siteImageAsJpeg } from '../../../utils/social/media'

// Public: a site image (under public/) as JPEG, for Instagram, which only takes JPEGs
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end()
  try {
    const data = await siteImageAsJpeg(String(req.query.path ?? ''))
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).send(data)
  } catch (err) {
    if (err instanceof AgentError) return res.status(err.status).json({ error: err.message })
    console.error('[site-image] failed:', err)
    return res.status(500).end()
  }
}
