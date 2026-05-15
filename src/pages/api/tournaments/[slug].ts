import type { NextApiRequest, NextApiResponse } from 'next'
import slugify from 'slug'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'
import { isTournamentStarted } from '../../../utils/brackets'
import {
  BracketDatabaseSnapshot,
  BracketType,
  TOURNAMENT_BRACKET_TYPES,
  TOURNAMENT_TEAM_COUNTS,
  Tournament,
  TournamentTeamCount,
} from '../../../types/types'

type TournamentRow = {
  slug: string
  name: string
  bracket_type: string
  team_count: number
  teams: string[]
  data: BracketDatabaseSnapshot | null
  updated_at: Date
  stream_match_id: number | null
}

const updatedAtToIso = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string' || typeof v === 'number') return new Date(v).toISOString()
  return new Date(0).toISOString()
}

const rowToTournament = (r: TournamentRow): Tournament => ({
  slug: r.slug,
  name: r.name,
  bracketType: r.bracket_type as BracketType,
  teamCount: r.team_count as TournamentTeamCount,
  teams: r.teams ?? [],
  data: r.data ?? null,
  isStarted: isTournamentStarted(r.data ?? null),
  updatedAt: updatedAtToIso(r.updated_at),
  streamMatchId: r.stream_match_id ?? null,
})

type PutBody = {
  name?: unknown
  bracketType?: unknown
  teamCount?: unknown
  teams?: unknown
  // `data: null` clears the built bracket; an object overwrites it.
  data?: unknown
  streamMatchId?: unknown
}

const isAllowedBracketType = (t: unknown): t is BracketType =>
  typeof t === 'string' && (TOURNAMENT_BRACKET_TYPES as string[]).includes(t)

const isAllowedTeamCount = (n: unknown): n is TournamentTeamCount =>
  typeof n === 'number' && (TOURNAMENT_TEAM_COUNTS as readonly number[]).includes(n)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[tournaments/:slug] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const rawSlug = req.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug
  if (!slug) return res.status(400).json({ error: 'Missing slug' })

  if (req.method === 'GET') {
    const rawPoll = req.query.poll
    const poll = Array.isArray(rawPoll) ? rawPoll[0] : rawPoll
    if (poll === '1') {
      const light = await pool.query(`SELECT updated_at FROM tournaments WHERE slug = $1`, [slug])
      if (light.rows.length === 0) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json({ updatedAt: updatedAtToIso(light.rows[0].updated_at) })
    }

    const result = await pool.query(
      `SELECT slug, name, bracket_type, team_count, teams, data, updated_at, stream_match_id
       FROM tournaments WHERE slug = $1`,
      [slug]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.status(200).json({ tournament: rowToTournament(result.rows[0] as TournamentRow) })
  }

  if (req.method === 'PUT') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const body = parseJsonBody<PutBody>(req)
    if (!body) return res.status(400).json({ error: 'Invalid body' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const existingRes = await client.query(
        `SELECT slug, name, bracket_type, team_count, teams, data, updated_at, stream_match_id
         FROM tournaments WHERE slug = $1 FOR UPDATE`,
        [slug]
      )
      if (existingRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Not found' })
      }
      const existing = existingRes.rows[0] as TournamentRow
      const wasStarted = isTournamentStarted(existing.data)

      const updates: string[] = []
      const params: unknown[] = []
      let nextSlug = existing.slug

      // Settings (name/bracketType/teamCount/teams) are locked once any match
      // has scores. Clearing `data` (the Restart tournament action) is allowed
      // at any time so admins can recover from a mis-started bracket.
      const isSettingsChange =
        body.name !== undefined ||
        body.bracketType !== undefined ||
        body.teamCount !== undefined ||
        body.teams !== undefined

      if (wasStarted && isSettingsChange) {
        await client.query('ROLLBACK')
        return res
          .status(409)
          .json({ error: 'Tournament has already started; settings are locked' })
      }

      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Invalid name' })
        }
        const trimmed = body.name.trim()
        const newSlug = slugify(trimmed)
        if (!newSlug) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Name must produce a non-empty slug' })
        }
        params.push(trimmed)
        updates.push(`name = $${params.length}`)
        params.push(newSlug)
        updates.push(`slug = $${params.length}`)
        nextSlug = newSlug
      }

      if (body.bracketType !== undefined) {
        if (!isAllowedBracketType(body.bracketType)) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Invalid bracketType' })
        }
        params.push(body.bracketType)
        updates.push(`bracket_type = $${params.length}`)
      }

      if (body.teamCount !== undefined) {
        if (!isAllowedTeamCount(body.teamCount)) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Invalid teamCount' })
        }
        params.push(body.teamCount)
        updates.push(`team_count = $${params.length}`)
      }

      if (body.teams !== undefined) {
        if (!Array.isArray(body.teams)) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Invalid teams' })
        }
        const teams = (body.teams as unknown[]).filter(
          (t): t is string => typeof t === 'string'
        )
        params.push(JSON.stringify(teams))
        updates.push(`teams = $${params.length}::jsonb`)
      }

      if (body.data !== undefined) {
        if (body.data === null) {
          updates.push(`data = NULL`)
        } else if (typeof body.data === 'object') {
          // Snapshot from `manager.export()`. Trust the shape but require the
          // top-level tables to exist.
          const snap = body.data as Record<string, unknown>
          const requiredTables = ['stage', 'group', 'round', 'match', 'match_game', 'participant']
          for (const t of requiredTables) {
            if (!Array.isArray(snap[t])) {
              await client.query('ROLLBACK')
              return res.status(400).json({ error: `Invalid data: missing table "${t}"` })
            }
          }
          params.push(JSON.stringify(snap))
          updates.push(`data = $${params.length}::jsonb`)
        } else {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Invalid data' })
        }
      }

      if (body.streamMatchId !== undefined) {
        if (body.streamMatchId === null) {
          updates.push(`stream_match_id = NULL`)
        } else if (
          typeof body.streamMatchId !== 'number' ||
          !Number.isInteger(body.streamMatchId) ||
          body.streamMatchId < 0
        ) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Invalid streamMatchId' })
        } else {
          params.push(body.streamMatchId)
          updates.push(`stream_match_id = $${params.length}`)
        }
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK')
        return res.status(200).json({ tournament: rowToTournament(existing) })
      }

      updates.push(`updated_at = now()`)
      params.push(existing.slug)
      let result
      try {
        result = await client.query(
          `UPDATE tournaments SET ${updates.join(', ')} WHERE slug = $${params.length}
           RETURNING slug, name, bracket_type, team_count, teams, data, updated_at, stream_match_id`,
          params
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await client.query('ROLLBACK').catch(() => undefined)
        if (msg.includes('duplicate key')) {
          return res
            .status(409)
            .json({ error: 'A tournament with that name or slug already exists' })
        }
        throw err
      }

      await client.query('COMMIT')
      const row = result.rows[0] as TournamentRow
      // If slug changed, surface the new one through the response.
      void nextSlug
      return res.status(200).json({ tournament: rowToTournament(row) })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      console.error('[tournaments/:slug] update failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    } finally {
      client.release()
    }
  }

  if (req.method === 'DELETE') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    await pool.query('DELETE FROM tournaments WHERE slug = $1', [slug])
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
