import type { Match, Participant, Round, Stage } from 'brackets-model'

import pool from './db_pg'
import { publish } from './bus'
import { teamNameToShortName } from './brackets'
import { findChallengermodeSeries } from './challengermodeStages'
import type {
  BracketDatabaseSnapshot,
  ChallengermodeTournament,
  TournamentOptions,
} from '../types/types'

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

export type StreamMatch = {
  teams: [StreamMatchTeam, StreamMatchTeam]
  // Series length, e.g. 3 for a Bo3
  bestOf: number
}

type StreamMatchSource = {
  data: BracketDatabaseSnapshot | null
  challengermode: ChallengermodeTournament | null
  // Needed for the best of of local tournaments
  options?: TournamentOptions
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

// Local tournaments only play Bo1, except the playoff final of Swiss tournaments (see getSwissFormatData)
const getLocalBestOf = (match: Match, source: StreamMatchSource) => {
  const stages = (source.data?.stage ?? []) as Stage[]
  const rounds = (source.data?.round ?? []) as Round[]
  const isSwiss = stages.some((s) => s.type === 'round_robin')
  const stage = stages.find((s) => s.id === match.stage_id)
  if (!isSwiss || stage?.type !== 'single_elimination' || !source.options) return 1
  const lastRound = rounds
    .filter((r) => r.stage_id === stage.id)
    .sort((a, b) => b.number - a.number)[0]
  return match.round_id === lastRound?.id ? source.options.finalBestOf : 1
}

// Both teams of the match, or null when the match doesn't exist or doesn't have both teams yet
export const getStreamMatch = (matchId: number, source: StreamMatchSource): StreamMatch | null => {
  if (source.challengermode) {
    const series = findChallengermodeSeries(source.challengermode, matchId)
    const [a, b] = series?.slots ?? []
    return series && a && b
      ? {
          teams: [
            toTeam(a.name, a.score, a.logo, a.players),
            toTeam(b.name, b.score, b.logo, b.players),
          ],
          bestOf: series.bestOf,
        }
      : null
  }
  const match = (source.data?.match as Match[] | undefined)?.find((m) => m.id === matchId)
  const participants = (source.data?.participant ?? []) as Participant[]
  const nameOf = (id: unknown) => participants.find((p) => p.id === id)?.name
  const team1 = nameOf(match?.opponent1?.id)
  const team2 = nameOf(match?.opponent2?.id)
  return match && team1 && team2
    ? {
        teams: [toTeam(team1, match.opponent1?.score), toTeam(team2, match.opponent2?.score)],
        bestOf: getLocalBestOf(match, source),
      }
    : null
}

export const getStreamMatchTeams = (
  matchId: number,
  source: StreamMatchSource
): [string, string] | null => {
  const teams = getStreamMatch(matchId, source)?.teams
  return teams ? [teams[0].name, teams[1].name] : null
}

export const setMapBanTeams = async ([team1, team2]: [string, string]) => {
  await pool.query('UPDATE mapban_info SET team1 = $1, team2 = $2 WHERE id = 1', [team1, team2])
  publish('mapbans')
}
