import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isBotRequest } from '../../../utils/botDetection'

const BUCKET_CAPACITY = 30
const BUCKET_REFILL_PER_SEC = 1
type Bucket = { tokens: number; updatedAt: number }
const buckets = new Map<string, Bucket>()

const takeToken = (key: string): boolean => {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing) {
    buckets.set(key, { tokens: BUCKET_CAPACITY - 1, updatedAt: now })
    return true
  }
  const elapsedSec = (now - existing.updatedAt) / 1000
  const refilled = Math.min(
    BUCKET_CAPACITY,
    existing.tokens + elapsedSec * BUCKET_REFILL_PER_SEC
  )
  if (refilled < 1) {
    existing.tokens = refilled
    existing.updatedAt = now
    return false
  }
  existing.tokens = refilled - 1
  existing.updatedAt = now
  return true
}

const getClientIp = (req: NextApiRequest): string => {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim()
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]
  return req.socket.remoteAddress || 'unknown'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (isBotRequest(req.headers)) {
    return res.status(204).end()
  }

  const ip = getClientIp(req)
  if (!takeToken(ip)) {
    return res.status(429).json({ error: 'Rate limited' })
  }

  const body = req.body as { path?: unknown } | undefined
  const rawPath = body?.path

  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.length > 2000) {
    return res.status(400).json({ error: 'Invalid path' })
  }

  if (!rawPath.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid path' })
  }

  try {
    await ensureMigrated()
    await pool.query('INSERT INTO page_views (path) VALUES ($1)', [rawPath])
    return res.status(204).end()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[analytics/track] insert failed:', message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
