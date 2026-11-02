import type { Match, Participant } from 'brackets-model'

import pool from './db_pg'
import { publish } from './bus'
import { findChallengermodeSeries } from './challengermode'
import type { BracketDatabaseSnapshot, ChallengermodeTournament } from '../types/types'

export const getStreamMatchTeams = (
  matchId: number,
  source: { data: BracketDatabaseSnapshot | null; challengermode: ChallengermodeTournament | null }
): [string, string] | null => {
  if (source.challengermode) {
    const series = findChallengermodeSeries(source.challengermode, matchId)
    const [a, b] = series?.slots ?? []
    return a && b ? [a.name, b.name] : null
  }
  const match = (source.data?.match as Match[] | undefined)?.find((m) => m.id === matchId)
  const participants = (source.data?.participant ?? []) as Participant[]
  const nameOf = (id: unknown) => participants.find((p) => p.id === id)?.name
  const team1 = nameOf(match?.opponent1?.id)
  const team2 = nameOf(match?.opponent2?.id)
  return team1 && team2 ? [team1, team2] : null
}

export const setMapBanTeams = async ([team1, team2]: [string, string]) => {
  await pool.query('UPDATE mapban_info SET team1 = $1, team2 = $2 WHERE id = 1', [team1, team2])
  publish('mapbans')
}
