// Wrapper of the admin-only posts API routes (/api/posts/**): checks the admin
// session and answers AgentErrors with their status and message.
import type { NextApiRequest, NextApiResponse } from 'next'
import { isAdminAuthorized } from '../adminSession'
import { AgentError } from '../agentApi'
import { ensureMigrated } from '../db_pg'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'
type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>

export const adminRoute =
  (handlers: Partial<Record<Method, Handler>>, { isPublic = false } = {}) =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (!isPublic && !isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const handle = handlers[req.method as Method]
    if (!handle) return res.status(405).json({ error: 'Method not allowed' })
    try {
      await ensureMigrated()
      const result = await handle(req, res)
      if (!res.headersSent) res.status(200).json(result ?? { ok: true })
    } catch (err) {
      if (err instanceof AgentError) return res.status(err.status).json({ error: err.message })
      console.error(`[posts-api] ${req.method} ${req.url} failed:`, err)
      if (!res.headersSent) res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' })
    }
  }

export const routeParam = (req: NextApiRequest, name: string) => {
  const raw = req.query[name]
  return String(Array.isArray(raw) ? raw[0] : (raw ?? ''))
}
