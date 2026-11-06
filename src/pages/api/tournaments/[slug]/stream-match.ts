import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { getChallengermodeTournament } from '../../../../utils/challengermode'
import { getStreamMatch } from '../../../../utils/streamMatchTeams'
import type { BracketDatabaseSnapshot, TournamentSource } from '../../../../types/types'

type Row = {
  source: TournamentSource
  challengermode_id: string | null
  data: BracketDatabaseSnapshot | null
  stream_match_id: number | null
}

// Public, no auth: the teams and series score of the tournament's stream game, for stream tools
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[tournaments/:slug/stream-match] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const rawSlug = req.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug
  if (!slug) return res.status(400).json({ error: 'Missing slug' })

  const result = await pool.query<Row>(
    'SELECT source, challengermode_id, data, stream_match_id FROM tournaments WHERE slug = $1',
    [slug]
  )
  const row = result.rows[0]
  if (!row) return res.status(404).json({ error: 'Not found' })

  // Cached, so polling this can't exceed the Challengermode request limit
  const cm =
    row.source === 'challengermode' && row.challengermode_id
      ? await getChallengermodeTournament(row.challengermode_id)
      : null
  const teams =
    row.stream_match_id != null
      ? getStreamMatch(row.stream_match_id, { data: row.data, challengermode: cm?.data ?? null })
      : null

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ team1: teams?.[0] ?? null, team2: teams?.[1] ?? null })
}
