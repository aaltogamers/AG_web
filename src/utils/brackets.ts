import type { Id, Match, Participant, Round } from 'brackets-model'
import { BracketData } from '../types/types'

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

export const groupToLabel = (groupId: Id) => {
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
  const roundsByGroup: Record<Id, Round[]> = {}

  for (const round of data.rounds) {
    const groupLabel = groupToLabel(round.group_id)

    if (!roundsByGroup[groupLabel]) {
      roundsByGroup[groupLabel] = []
    }

    roundsByGroup[groupLabel].push(round)
  }

  return roundsByGroup
}
