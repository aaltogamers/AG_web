import type { NextApiRequest, NextApiResponse } from 'next'
import slugify from 'slug'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'
import { isTournamentStarted } from '../../../utils/brackets'
import { getChallengermodeTournament } from '../../../utils/challengermode'
import { getStreamMatchTeams, setMapBanTeams } from '../../../utils/streamMatchTeams'
import {
  BracketDatabaseSnapshot,
  BracketType,
  ChallengermodeTournament,
  TOURNAMENT_BRACKET_TYPES,
  TOURNAMENT_TEAM_COUNTS,
  Tournament,
  TournamentSource,
  TournamentTeamCount,
  normalizeTournamentOptions,
} from '../../../types/types'

type TournamentRow = {
  source: TournamentSource
  challengermode_id: string | null
  slug: string
  name: string
  bracket_type: string
  team_count: number
  teams: string[]
  options: unknown
  data: BracketDatabaseSnapshot | null
  updated_at: Date
  stream_match_id: number | null
}

const updatedAtToIso = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string' || typeof v === 'number') return new Date(v).toISOString()
  return new Date(0).toISOString()
}

const COLUMNS = `slug, name, source, challengermode_id, bracket_type, team_count, teams, options, data, updated_at, stream_match_id`

const loadChallengermode = async (r: Pick<TournamentRow, 'source' | 'challengermode_id'>) =>
  r.source === 'challengermode' && r.challengermode_id
    ? await getChallengermodeTournament(r.challengermode_id)
    : null

const rowToTournament = (
  r: TournamentRow,
  challengermode: ChallengermodeTournament | null = null
): Tournament => ({
  slug: r.slug,
  name: r.name,
  source: r.source,
  challengermodeId: r.challengermode_id,
  bracketType: r.bracket_type as BracketType,
  teamCount: r.team_count as TournamentTeamCount,
  teams: r.teams ?? [],
  options: normalizeTournamentOptions(r.options),
  data: r.data ?? null,
  isStarted:
    r.source === 'challengermode'
      ? challengermode?.state === 'RUNNING' || challengermode?.state === 'COMPLETED'
      : isTournamentStarted(r.data ?? null),
  updatedAt: updatedAtToIso(r.updated_at),
  streamMatchId: r.stream_match_id ?? null,
  challengermode,
})

type PutBody = {
  name?: unknown
  bracketType?: unknown
  teamCount?: unknown
  teams?: unknown
  options?: unknown
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
      const light = await pool.query(
        `SELECT updated_at, source, challengermode_id FROM tournaments WHERE slug = $1`,
        [slug]
      )
      if (light.rows.length === 0) return res.status(404).json({ error: 'Not found' })
      const row = light.rows[0]
      const cm = await loadChallengermode(row)
      const updatedAt = updatedAtToIso(row.updated_at)
      return res.status(200).json({ updatedAt: cm ? `${updatedAt}|${cm.hash}` : updatedAt })
    }

    const result = await pool.query(`SELECT ${COLUMNS} FROM tournaments WHERE slug = $1`, [slug])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const row = result.rows[0] as TournamentRow
    const cm = await loadChallengermode(row)
    const tournament = rowToTournament(row, cm?.data ?? null)
    return res.status(200).json({
      tournament: cm
        ? { ...tournament, updatedAt: `${tournament.updatedAt}|${cm.hash}` }
        : tournament,
      ...(cm?.error ? { challengermodeError: cm.error } : {}),
    })
  }

  if (req.method === 'PUT') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const body = parseJsonBody<PutBody>(req)
    if (!body) return res.status(400).json({ error: 'Invalid body' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const existingRes = await client.query(
        `SELECT ${COLUMNS} FROM tournaments WHERE slug = $1 FOR UPDATE`,
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
        body.teams !== undefined ||
        body.options !== undefined

      const isChallengermode = existing.source === 'challengermode'
      if (
        isChallengermode &&
        (body.bracketType !== undefined ||
          body.teamCount !== undefined ||
          body.teams !== undefined ||
          body.options !== undefined ||
          body.data !== undefined)
      ) {
        await client.query('ROLLBACK')
        return res
          .status(400)
          .json({ error: 'Challengermode tournaments are edited on Challengermode' })
      }

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
        const teams = (body.teams as unknown[]).filter((t): t is string => typeof t === 'string')
        params.push(JSON.stringify(teams))
        updates.push(`teams = $${params.length}::jsonb`)
      }

      if (body.options !== undefined) {
        if (!body.options || typeof body.options !== 'object') {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Invalid options' })
        }
        params.push(JSON.stringify(normalizeTournamentOptions(body.options)))
        updates.push(`options = $${params.length}::jsonb`)
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
        const cm = await loadChallengermode(existing)
        return res.status(200).json({ tournament: rowToTournament(existing, cm?.data ?? null) })
      }

      updates.push(`updated_at = now()`)
      params.push(existing.slug)
      let result
      try {
        result = await client.query(
          `UPDATE tournaments SET ${updates.join(', ')} WHERE slug = $${params.length}
           RETURNING ${COLUMNS}`,
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
      const cm = await loadChallengermode(row)
      if (typeof body.streamMatchId === 'number') {
        const teams = getStreamMatchTeams(body.streamMatchId, {
          data: row.data,
          challengermode: cm?.data ?? null,
        })
        if (teams) {
          await setMapBanTeams(teams).catch((err) =>
            console.error('[tournaments/:slug] updating map ban teams failed:', err)
          )
        }
      }
      const tournament = rowToTournament(row, cm?.data ?? null)
      return res.status(200).json({
        tournament: cm
          ? { ...tournament, updatedAt: `${tournament.updatedAt}|${cm.hash}` }
          : tournament,
      })
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
