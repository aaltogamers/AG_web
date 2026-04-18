import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import {
  CS_ACTIVE_DUTY_MAPS,
  VALORANT_ACTIVE_DUTY_MAPS,
} from '../../../types/types'
import { getQueryParam, parseJsonBody } from '../../../utils/apiUtils'
import { publish } from '../../../utils/bus'

type PostBody = {
  map: string
  type: 'ban' | 'pick' | 'decider'
  team: 'team1' | 'team2'
}

const ALLOWED_TYPES = new Set(['ban', 'pick', 'decider'])
const ALLOWED_TEAMS = new Set(['team1', 'team2'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[mapbans] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const result = await pool.query(
      'SELECT id, map, type, team, idx FROM mapbans ORDER BY idx ASC'
    )
    return res.status(200).json({
      mapBans: result.rows.map((r) => ({
        id: String(r.id),
        map: r.map,
        type: r.type,
        team: r.team,
        index: r.idx,
      })),
    })
  }

  if (req.method === 'POST') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const body = parseJsonBody<PostBody>(req)
    if (
      !body ||
      typeof body.map !== 'string' ||
      !ALLOWED_TYPES.has(body.type) ||
      !ALLOWED_TEAMS.has(body.team)
    ) {
      return res.status(400).json({ error: 'Invalid body' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const infoRes = await client.query('SELECT game FROM mapban_info WHERE id = 1 FOR UPDATE')
      const game = infoRes.rows[0]?.game ?? 'CS 2'
      const allowedMaps: string[] =
        game === 'Valorant'
          ? [...VALORANT_ACTIVE_DUTY_MAPS]
          : [...CS_ACTIVE_DUTY_MAPS]
      if (!allowedMaps.includes(body.map)) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Map not in current pool' })
      }

      const countRes = await client.query('SELECT COUNT(*)::int AS c FROM mapbans')
      const currentCount = countRes.rows[0]?.c ?? 0

      await client.query(
        `INSERT INTO mapbans (map, type, team, idx)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (map) DO UPDATE SET
           type = EXCLUDED.type,
           team = EXCLUDED.team`,
        [body.map, body.type, body.team, currentCount]
      )

      // If this was the sixth ban/pick, auto-fill the decider with the remaining map.
      const afterRes = await client.query('SELECT map FROM mapbans')
      const takenMaps = new Set(afterRes.rows.map((r) => r.map))
      if (afterRes.rows.length === 6) {
        const remaining = allowedMaps.find((m) => !takenMaps.has(m))
        if (remaining) {
          await client.query(
            `INSERT INTO mapbans (map, type, team, idx)
             VALUES ($1, 'decider', 'team1', 6)
             ON CONFLICT (map) DO NOTHING`,
            [remaining]
          )
        }
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      console.error('[mapbans] insert failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    } finally {
      client.release()
    }

    publish('mapbans')
    return res.status(204).end()
  }

  if (req.method === 'DELETE') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const map = getQueryParam(req, 'map')
    if (map) {
      await pool.query('DELETE FROM mapbans WHERE map = $1', [map])
    } else {
      await pool.query('DELETE FROM mapbans')
    }
    publish('mapbans')
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
