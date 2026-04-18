import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../utils/db_pg'
import { isAdminAuthorized } from '../../utils/adminSession'
import { parseJsonBody } from '../../utils/apiUtils'
import { publish } from '../../utils/bus'

type PutBody = {
  team1?: string
  team2?: string
  game?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[mapban-info] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const result = await pool.query(
      'SELECT team1, team2, game FROM mapban_info WHERE id = 1'
    )
    const row = result.rows[0] ?? { team1: '', team2: '', game: 'CS 2' }
    return res.status(200).json({ mapBanInfo: row })
  }

  if (req.method === 'PUT') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const body = parseJsonBody<PutBody>(req)
    if (!body) return res.status(400).json({ error: 'Invalid body' })

    const updates: string[] = []
    const params: unknown[] = []
    if (typeof body.team1 === 'string') {
      params.push(body.team1)
      updates.push(`team1 = $${params.length}`)
    }
    if (typeof body.team2 === 'string') {
      params.push(body.team2)
      updates.push(`team2 = $${params.length}`)
    }
    if (typeof body.game === 'string') {
      if (body.game !== 'CS 2' && body.game !== 'Valorant') {
        return res.status(400).json({ error: 'Unknown game' })
      }
      params.push(body.game)
      updates.push(`game = $${params.length}`)
    }

    if (updates.length === 0) return res.status(204).end()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE mapban_info SET ${updates.join(', ')} WHERE id = 1`,
        params
      )
      if (typeof body.game === 'string') {
        // Switching games invalidates the ban list.
        await client.query('DELETE FROM mapbans')
        publish('mapbans')
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      console.error('[mapban-info] update failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    } finally {
      client.release()
    }

    publish('mapbans')
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
