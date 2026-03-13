import type { Id, Match, Participant, Round } from 'brackets-model'
import { BracketData, RoundLabel } from '../types/types'

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

export const groupToLabel = (groupId: Id): RoundLabel => {
  switch (groupId) {
    case 0:
      return 'Upper'
    case 1:
      return 'Lower'
    case 2:
      return `Final`
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

/** Result for a TBD slot: which match feeds it and whether it's the winner or loser. */
export type FeederInfo =
  | { feederMatchId: Id; feederType: 'winner' }
  | { feederMatchId: Id; feederType: 'loser' }
  | null

/**
 * For double elimination: returns which match fills this slot (winner or loser) when the slot is TBD.
 * For Upper bracket, slots are always filled by the winner of a previous round match.
 * For Lower bracket: round 0 gets losers from Upper round 0; odd rounds get one winner from LB prev + one loser from UB; even rounds (≥2) get winners from LB prev.
 */
export const getFeederForSlot = (
  groupLabel: string,
  roundIndex: number,
  matchIndex: number,
  participant: 'opponent1' | 'opponent2',
  roundsByGroup: Record<string, Round[]>,
  matchesByRound: Record<Id, Match[]>
): FeederInfo => {
  const sortedMatches = (roundId: Id) =>
    (matchesByRound[roundId] ?? []).sort((a, b) => a.number - b.number)

  if (groupLabel === 'Upper') {
    const prevRound = roundsByGroup[groupLabel]?.[roundIndex - 1]
    if (!prevRound) return null
    const prevMatches = sortedMatches(prevRound.id)
    const feederIndex = participant === 'opponent1' ? matchIndex * 2 : matchIndex * 2 + 1
    const feeder = prevMatches[feederIndex]
    return feeder ? { feederMatchId: feeder.id, feederType: 'winner' } : null
  }

  if (groupLabel === 'Lower') {
    if (roundIndex === 0) {
      const upperRound0 = roundsByGroup['Upper']?.[0]
      if (!upperRound0) return null
      const upperMatches = sortedMatches(upperRound0.id)
      const feederIndex = participant === 'opponent1' ? matchIndex * 2 : matchIndex * 2 + 1
      const feeder = upperMatches[feederIndex]
      return feeder ? { feederMatchId: feeder.id, feederType: 'loser' } : null
    }
    if (roundIndex % 2 === 1) {
      const prevRound = roundsByGroup['Lower']?.[roundIndex - 1]
      const upperRound = roundsByGroup['Upper']?.[(roundIndex + 1) / 2]
      if (participant === 'opponent1') {
        if (!prevRound) return null
        const prevMatches = sortedMatches(prevRound.id)
        const feeder = prevMatches[matchIndex * 2]
        return feeder ? { feederMatchId: feeder.id, feederType: 'winner' } : null
      }
      if (!upperRound) return null
      const upperMatches = sortedMatches(upperRound.id)
      const feeder = upperMatches[matchIndex]
      return feeder ? { feederMatchId: feeder.id, feederType: 'loser' } : null
    }
    const prevRound = roundsByGroup['Lower']?.[roundIndex - 1]
    if (!prevRound) return null
    const prevMatches = sortedMatches(prevRound.id)
    const feederIndex = participant === 'opponent1' ? matchIndex * 2 : matchIndex * 2 + 1
    const feeder = prevMatches[feederIndex]
    return feeder ? { feederMatchId: feeder.id, feederType: 'winner' } : null
  }

  return null
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
