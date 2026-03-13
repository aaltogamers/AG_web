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

export const roundToLabel = (round: Round) => {
  const groupLabel = groupToLabel(round.group_id)

  if (groupLabel === 'Final') {
    return groupLabel
  }

  if (groupLabel === 'Upper') {
    return `Round ${round.number}`
  }

  return `${groupLabel} Round ${round.number}`
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
