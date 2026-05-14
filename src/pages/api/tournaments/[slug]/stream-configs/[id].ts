import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../../utils/db_pg'
import { isAdminAuthorized } from '../../../../../utils/adminSession'
import { parseJsonBody } from '../../../../../utils/apiUtils'
import type { StreamConfig } from '../../../../../types/types'

type Row = {
  id: string
  name: string
  query: string
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
    console.error('[stream-configs/:id] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  const rawSlug = req.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug
  if (!slug) return res.status(400).json({ error: 'Missing slug' })

  const rawId = req.query.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (!id) return res.status(400).json({ error: 'Missing id' })

  const tournamentId = await lookupTournamentId(slug)
  if (!tournamentId) return res.status(404).json({ error: 'Tournament not found' })

  if (req.method === 'PUT') {
    const body = parseJsonBody<{ name?: unknown; query?: unknown }>(req)
    if (!body) return res.status(400).json({ error: 'Invalid body' })
    const updates: string[] = []
    const params: unknown[] = []
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return res.status(400).json({ error: 'Invalid name' })
      }
      params.push(body.name.trim())
      updates.push(`name = $${params.length}`)
    }
    if (body.query !== undefined) {
      if (typeof body.query !== 'string') {
        return res.status(400).json({ error: 'Invalid query' })
      }
      params.push(body.query)
      updates.push(`query = $${params.length}`)
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' })
    }
    updates.push(`updated_at = now()`)
    params.push(tournamentId)
    params.push(id)
    try {
      const result = await pool.query<Row>(
        `UPDATE tournament_stream_configs SET ${updates.join(', ')}
         WHERE tournament_id = $${params.length - 1} AND id = $${params.length}
         RETURNING id, name, query`,
        params
      )
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json({ config: rowToConfig(result.rows[0]) })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('duplicate key')) {
        return res.status(409).json({ error: 'A config with that name already exists' })
      }
      console.error('[stream-configs/:id] update failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }

  if (req.method === 'DELETE') {
    await pool.query(
      `DELETE FROM tournament_stream_configs WHERE tournament_id = $1 AND id = $2`,
      [tournamentId, id]
    )
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
