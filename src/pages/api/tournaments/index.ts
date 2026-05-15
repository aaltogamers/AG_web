import type { NextApiRequest, NextApiResponse } from 'next'
import slug from 'slug'
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
  TournamentSummary,
  TournamentTeamCount,
} from '../../../types/types'

type TournamentRow = {
  slug: string
  name: string
  bracket_type: string
  team_count: number
  teams: string[]
  data: BracketDatabaseSnapshot | null
  updated_at?: Date
  stream_match_id?: number | null
}

const rowToSummary = (r: TournamentRow): TournamentSummary => ({
  slug: r.slug,
  name: r.name,
  bracketType: r.bracket_type as BracketType,
  teamCount: r.team_count as TournamentTeamCount,
  teams: r.teams ?? [],
  isStarted: isTournamentStarted(r.data ?? null),
})

type CreateBody = {
  name?: unknown
  bracketType?: unknown
  teamCount?: unknown
  teams?: unknown
}

const isAllowedBracketType = (t: unknown): t is BracketType =>
  typeof t === 'string' && (TOURNAMENT_BRACKET_TYPES as string[]).includes(t)

const isAllowedTeamCount = (n: unknown): n is TournamentTeamCount =>
  typeof n === 'number' && (TOURNAMENT_TEAM_COUNTS as readonly number[]).includes(n)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[tournaments] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method === 'GET') {
    const result = await pool.query(
      `SELECT slug, name, bracket_type, team_count, teams, data
       FROM tournaments ORDER BY created_at DESC`
    )
    return res
      .status(200)
      .json({ tournaments: result.rows.map((r: TournamentRow) => rowToSummary(r)) })
  }

  if (req.method === 'POST') {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = parseJsonBody<CreateBody>(req)
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return res.status(400).json({ error: 'Invalid body: name is required' })
    }
    if (!isAllowedBracketType(body.bracketType)) {
      return res.status(400).json({ error: 'Invalid bracketType' })
    }
    if (!isAllowedTeamCount(body.teamCount)) {
      return res.status(400).json({ error: 'Invalid teamCount' })
    }

    const name = body.name.trim()
    const tournamentSlug = slug(name)
    if (!tournamentSlug) {
      return res.status(400).json({ error: 'Name must produce a non-empty slug' })
    }

    const teams = Array.isArray(body.teams)
      ? (body.teams as unknown[]).filter((t): t is string => typeof t === 'string')
      : []

    try {
      const result = await pool.query(
        `INSERT INTO tournaments (slug, name, bracket_type, team_count, teams, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now())
         RETURNING slug, name, bracket_type, team_count, teams, data, updated_at, stream_match_id`,
        [tournamentSlug, name, body.bracketType, body.teamCount, JSON.stringify(teams)]
      )
      const row = result.rows[0] as TournamentRow
      const ua = row.updated_at
      if (!ua) {
        console.error('[tournaments] insert missing updated_at')
        return res.status(500).json({ error: 'Internal error' })
      }
      const updatedAt = ua instanceof Date ? ua.toISOString() : new Date(ua).toISOString()
      const tournament: Tournament = {
        ...rowToSummary(row),
        data: row.data ?? null,
        updatedAt,
        streamMatchId: row.stream_match_id ?? null,
      }
      return res.status(201).json({
        tournament,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('duplicate key')) {
        return res.status(409).json({ error: 'A tournament with that name or slug already exists' })
      }
      console.error('[tournaments] insert failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
