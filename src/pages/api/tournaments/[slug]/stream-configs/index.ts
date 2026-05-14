import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../../utils/db_pg'
import { isAdminAuthorized } from '../../../../../utils/adminSession'
import { parseJsonBody } from '../../../../../utils/apiUtils'
import type { StreamConfig } from '../../../../../types/types'

type Row = {
  id: string
  name: string
  query: string
  created_at: Date
  updated_at: Date
}

const rowToConfig = (r: Row): StreamConfig => ({
  id: String(r.id),
  name: r.name,
  query: r.query,
})

const lookupTournamentId = async (slug: string): Promise<string | null> => {
  const res = await pool.query<{ id: string }>(
    'SELECT id FROM tournaments WHERE slug = $1',
    [slug]
  )
  return res.rows[0]?.id ?? null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[stream-configs] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const rawSlug = req.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug
  if (!slug) return res.status(400).json({ error: 'Missing slug' })

  // Listing and writing both require admin — stream configs are an admin-only
  // tool, not user-facing.
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  const tournamentId = await lookupTournamentId(slug)
  if (!tournamentId) return res.status(404).json({ error: 'Tournament not found' })

  if (req.method === 'GET') {
    const result = await pool.query<Row>(
      `SELECT id, name, query, created_at, updated_at
       FROM tournament_stream_configs
       WHERE tournament_id = $1
       ORDER BY name ASC`,
      [tournamentId]
    )
    return res.status(200).json({ configs: result.rows.map(rowToConfig) })
  }

  if (req.method === 'POST') {
    const body = parseJsonBody<{ name?: unknown; query?: unknown }>(req)
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return res.status(400).json({ error: 'Invalid body: name is required' })
    }
    if (typeof body.query !== 'string') {
      return res.status(400).json({ error: 'Invalid body: query is required' })
    }
    try {
      const result = await pool.query<Row>(
        `INSERT INTO tournament_stream_configs (tournament_id, name, query, updated_at)
         VALUES ($1, $2, $3, now())
         RETURNING id, name, query, created_at, updated_at`,
        [tournamentId, body.name.trim(), body.query]
      )
      return res.status(201).json({ config: rowToConfig(result.rows[0]) })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('duplicate key')) {
        return res.status(409).json({ error: 'A config with that name already exists' })
      }
      console.error('[stream-configs] insert failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
