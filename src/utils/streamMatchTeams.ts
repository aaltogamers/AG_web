import type { Match, Participant } from 'brackets-model'

import pool from './db_pg'
import { publish } from './bus'
import { teamNameToShortName } from './brackets'
import { findChallengermodeSeries } from './challengermodeStages'
import type { BracketDatabaseSnapshot, ChallengermodeTournament } from '../types/types'

export type StreamMatchTeam = {
  name: string
  shortName: string
  // Logo URL; only Challengermode teams have one
  logo: string | null
  // Player usernames; only Challengermode teams have them
  players: string[]
  // Games won in the series so far
  score: number
}

type StreamMatchSource = {
  data: BracketDatabaseSnapshot | null
  challengermode: ChallengermodeTournament | null
}

const toTeam = (
  name: string,
  score: number | null | undefined,
  logo: string | null = null,
  players: string[] = []
): StreamMatchTeam => ({
  name,
  shortName: teamNameToShortName(name),
  logo,
  players,
  score: score ?? 0,
})

// Both teams of the match, or null when the match doesn't exist or doesn't have both teams yet
export const getStreamMatch = (
  matchId: number,
  source: StreamMatchSource
): [StreamMatchTeam, StreamMatchTeam] | null => {
  if (source.challengermode) {
    const series = findChallengermodeSeries(source.challengermode, matchId)
    const [a, b] = series?.slots ?? []
    return a && b
      ? [toTeam(a.name, a.score, a.logo, a.players), toTeam(b.name, b.score, b.logo, b.players)]
      : null
  }
  const match = (source.data?.match as Match[] | undefined)?.find((m) => m.id === matchId)
  const participants = (source.data?.participant ?? []) as Participant[]
  const nameOf = (id: unknown) => participants.find((p) => p.id === id)?.name
  const team1 = nameOf(match?.opponent1?.id)
  const team2 = nameOf(match?.opponent2?.id)
  return team1 && team2
    ? [toTeam(team1, match?.opponent1?.score), toTeam(team2, match?.opponent2?.score)]
    : null
}

export const getStreamMatchTeams = (
  matchId: number,
  source: StreamMatchSource
): [string, string] | null => {
  const teams = getStreamMatch(matchId, source)
  return teams && [teams[0].name, teams[1].name]
}

export const setMapBanTeams = async ([team1, team2]: [string, string]) => {
  await pool.query('UPDATE mapban_info SET team1 = $1, team2 = $2 WHERE id = 1', [team1, team2])
  publish('mapbans')
}
