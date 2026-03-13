import type { Id, Match, Participant, Round } from 'brackets-model'
import { BracketData, OpponentFroMatch, RoundLabel } from '../types/types'
import { BracketsManager } from 'brackets-manager'

export const getMatchesByRound = (data: BracketData): Record<Id, Match[]> => {
  const matchesByRound: Record<Id, Match[]> = {}
  for (const match of data.matches) {
    if (!matchesByRound[match.round_id]) {
      matchesByRound[match.round_id] = []
    }
    matchesByRound[match.round_id].push(match)
  }
  return matchesByRound
}

export const getParticipantsById = (data: BracketData): Record<Id, Participant> => {
  const participantsById: Record<Id, Participant> = {}
  for (const participant of data.participants) {
    participantsById[participant.id] = participant
  }
  return participantsById
}

// TODO: Make support more than double elim -> single elim
export const groupToLabel = (groupId: Id): RoundLabel => {
  switch (groupId) {
    case 0:
      return 'Upper'
    case 1:
      return 'Lower'
    case 2:
      return `Final`
    case 3:
      return 'Upper'
    default:
      return `Unknown`
  }
}

export const getGroupHasFinal = (
  groupLabel: string,
  roundsByGroup: Record<string, Round[]>,
  matchesByRound: Record<Id, Match[]>
) => {
  const rounds = roundsByGroup[groupLabel]

  return rounds?.some((round) => matchesByRound[round.id].length === 1)
}

export const roundToLabel = (
  round: Round,
  matchesByRound: Record<Id, Match[]>,
  groupHasFinal: boolean
) => {
  const groupLabel = groupToLabel(round.group_id)

  if (groupLabel === 'Final') {
    return groupLabel
  }

  if (groupLabel === 'Upper') {
    const matchCount = matchesByRound[round.id].length

    if (groupHasFinal && matchCount === 1) {
      return 'Final'
    }

    if (groupHasFinal && matchCount === 2) {
      return 'Semi-final'
    }

    if (groupHasFinal && matchCount === 4) {
      return 'Quarter-final'
    }

    return `Round ${round.number}`
  }

  return `${groupLabel} Round ${round.number}`
}

// For now, only finds losers, and slot (opponent1 vs opponent2) might not be accurate
export const getPrevMatches = async (matches: Match[], manager: BracketsManager) => {
  const prevMatches: Record<
    Id,
    { opponent1From?: OpponentFroMatch; opponent2From?: OpponentFroMatch }
  > = {}

  for (const match of matches) {
    const nextMatches = await manager.find.nextMatches(match.id)

    const losersGame = nextMatches[1]

    if (losersGame) {
      if (!prevMatches[losersGame.id]) {
        prevMatches[losersGame.id] = {}
      }

      if (losersGame.number % 2 !== 0) {
        prevMatches[losersGame.id] = {
          ...prevMatches[losersGame.id],
          opponent1From: { match, outcome: 'loser' },
        }
      }

      if (losersGame.number % 2 === 0) {
        prevMatches[losersGame.id] = {
          ...prevMatches[losersGame.id],
          opponent2From: { match, outcome: 'loser' },
        }
      }
    }
  }

  return prevMatches
}

export const getRoundsByGroup = (data: BracketData) => {
  const roundsByGroup: Partial<Record<RoundLabel, Round[]>> = {}

  for (const round of data.rounds) {
    const groupLabel = groupToLabel(round.group_id)

    if (!roundsByGroup[groupLabel]) {
      roundsByGroup[groupLabel] = []
    }

    roundsByGroup[groupLabel].push(round)
  }

  return roundsByGroup
}

export const getTopFourTeamsFromDoubleElimQualifiers = (data: BracketData): Participant[] => {
  const roundsByGroup = getRoundsByGroup(data)
  const matchesByRound = getMatchesByRound(data)
  const participantsById = getParticipantsById(data)

  const matchesWithWinners: Match[] = []

  for (const group of ['Upper', 'Lower'] as const) {
    const rounds = roundsByGroup[group]
    if (!rounds?.length) continue

    const roundsWithAtLeastTwoMatches = rounds.filter(
      (round) => (matchesByRound[round.id] ?? []).length >= 2
    )

    if (roundsWithAtLeastTwoMatches.length === 0) continue

    const highestRound = roundsWithAtLeastTwoMatches.reduce((a, b) =>
      a.number >= b.number ? a : b
    )

    const roundMatches = (matchesByRound[highestRound.id] ?? []).sort((a, b) => a.number - b.number)

    matchesWithWinners.push(...roundMatches)
  }

  matchesWithWinners.sort((a, b) => {
    const groupOrderA = groupToLabel(a.group_id) === 'Upper' ? 0 : 1
    const groupOrderB = groupToLabel(b.group_id) === 'Upper' ? 0 : 1
    if (groupOrderA !== groupOrderB) return groupOrderA - groupOrderB
    return a.number - b.number
  })

  const winners: Participant[] = []
  for (const match of matchesWithWinners) {
    const winnerId =
      match.opponent1?.result === 'win'
        ? match.opponent1.id
        : match.opponent2?.result === 'win'
          ? (match.opponent2?.id ?? null)
          : null
    if (winnerId != null) {
      const participant = participantsById[winnerId]
      if (participant) winners.push(participant)
    }
  }
  return winners
}

export const getBracketData = async (
  manager: BracketsManager,
  stageId: Id,
  matchIdsToSkip: Set<Id>
): Promise<BracketData> => {
  const {
    group: groups,
    match: matches,
    match_game: matchGames,
    participant: participants,
    round: rounds,
    stage: stages,
  } = await manager.get.stageData(stageId)

  const filteredMatches = (matches ?? []).filter((match) => !matchIdsToSkip.has(match.id))
  const filteredRoundIds = new Set(filteredMatches.map((match) => match.round_id))
  const filteredRounds = (rounds ?? []).filter((round) => filteredRoundIds.has(round.id))

  const prevMatches = await getPrevMatches(filteredMatches, manager)

  return {
    manager: manager,
    stages: stages,
    groups: groups,
    rounds: filteredRounds,
    matches: filteredMatches,
    matchGames: matchGames,
    participants: participants,
    prevMatches,
  }
}
