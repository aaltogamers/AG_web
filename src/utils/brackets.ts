import type { Id, Match, Participant, Round } from 'brackets-model'
import { Status } from 'brackets-model'
import {
  BracketData,
  BracketDatabaseSnapshot,
  BracketType,
  OpponentFroMatch,
  RoundLabel,
} from '../types/types'
import { BracketsManager } from 'brackets-manager'

/**
 * Updates a match result via the brackets manager.
 * When inProgress is true, only updates scores and sets status to Running (does not end the match).
 * When inProgress is false, sets status to Completed and assigns scores and win/loss.
 */
export const updateMatchResult = async (
  manager: BracketsManager,
  {
    matchId,
    score1,
    score2,
    inProgress,
  }: {
    matchId: Id
    score1: number
    score2: number
    inProgress: boolean
  }
) => {
  if (inProgress) {
    // Reset result and clear propagated winner/loser in downstream matches, then set scores and status.
    await manager.reset.matchResults(matchId)
    await manager.update.match({
      id: matchId,
      status: Status.Running,
      opponent1: { score: score1 },
      opponent2: { score: score2 },
    })
    return
  }

  const result1 =
    score1 > score2 ? ('win' as const) : score1 < score2 ? ('loss' as const) : ('draw' as const)
  const result2 =
    score2 > score1 ? ('win' as const) : score2 < score1 ? ('loss' as const) : ('draw' as const)

  await manager.update.match({
    id: matchId,
    status: Status.Completed,
    opponent1: { score: score1, result: result1 },
    opponent2: { score: score2, result: result2 },
  })
}

/**
 * Clears the match result and scores, and updates related matches (downstream winner/loser slots become TBD again).
 * Uses the manager's reset API for propagation, then clears scores on the current match.
 */
export const resetMatchResult = async (manager: BracketsManager, matchId: Id): Promise<void> => {
  await manager.reset.matchResults(matchId)
  await manager.update.match({
    id: matchId,
    opponent1: { score: undefined },
    opponent2: { score: undefined },
  })
}

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
  groupHasFinal: boolean,
  visibleRoundNumber: number = round.number
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

    return `Round ${visibleRoundNumber}`
  }

  return `${groupLabel} Round ${visibleRoundNumber}`
}

// For now, only finds losers, and slot (opponent1 vs opponent2) is not accurate
export const getPrevMatches = async (matches: Match[], manager: BracketsManager) => {
  const prevMatches: Record<
    Id,
    { opponent1From?: OpponentFroMatch; opponent2From?: OpponentFroMatch }
  > = {}

  for (const match of matches) {
    // BYE source matches have no real loser to label, so skip them entirely.
    const matchIsBye = match.opponent1 === null || match.opponent2 === null
    if (matchIsBye) continue

    const nextMatches = await manager.find.nextMatches(match.id)
    let losersGame = nextMatches[1]
    if (!losersGame) continue

    // The id whose position we use to identify the slot of `losersGame` to
    // write the preview into. Equals `match.id` normally, but when we
    // propagate past a BYE losers game, it's that pass-through match's id.
    let slotFeederId: Id = match.id

    // If the target losers game is itself a BYE (because the source's sibling
    // is a BYE), the "loser of match" preview is propagated one step forward
    // in the losers bracket so it appears against the real next opponent.
    const losersGameIsBye =
      losersGame.opponent1 === null || losersGame.opponent2 === null
    if (losersGameIsBye) {
      const losersGameNextMatches = await manager.find.nextMatches(losersGame.id)
      const propagated = losersGameNextMatches[0]
      if (!propagated) continue
      slotFeederId = losersGame.id
      losersGame = propagated
    }

    // Determine which slot of losersGame the feeder fills. previousMatches
    // returns feeders in [opp1Feeder, opp2Feeder] order.
    const prevsOfLosersGame = await manager.find.previousMatches(losersGame.id)
    let slot: 'opponent1From' | 'opponent2From' | null = null
    if (prevsOfLosersGame[0]?.id === slotFeederId) slot = 'opponent1From'
    else if (prevsOfLosersGame[1]?.id === slotFeederId) slot = 'opponent2From'

    if (slot == null) continue

    prevMatches[losersGame.id] = {
      ...(prevMatches[losersGame.id] ?? {}),
      [slot]: { match, outcome: 'loser' },
    }
  }

  return prevMatches
}

// Finds the sibling match for each match: another match that feeds into the same next match.
export const getSiblingMatches = async (
  matches: Match[],
  manager: BracketsManager
): Promise<Record<Id, Match>> => {
  const matchesByNextMatchId: Record<Id, Match[]> = {}

  for (const match of matches) {
    const nextMatches = await manager.find.nextMatches(match.id)
    const winnersNext = nextMatches[0]
    if (!winnersNext) continue

    if (!matchesByNextMatchId[winnersNext.id]) {
      matchesByNextMatchId[winnersNext.id] = []
    }
    matchesByNextMatchId[winnersNext.id].push(match)
  }

  const siblingMatches: Record<Id, Match> = {}
  for (const matchesSharingNext of Object.values(matchesByNextMatchId)) {
    if (matchesSharingNext.length !== 2) continue
    const [a, b] = matchesSharingNext
    siblingMatches[a.id] = b
    siblingMatches[b.id] = a
  }

  return siblingMatches
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

export const isRoundAllBye = (round: Round, matchesByRound: Record<Id, Match[]>) => {
  const roundMatches = matchesByRound[round.id] ?? []
  return (
    roundMatches.length > 0 &&
    roundMatches.every((m) => m.opponent1 === null || m.opponent2 === null)
  )
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
  const siblingMatches = await getSiblingMatches(filteredMatches, manager)

  return {
    manager: manager,
    stages: stages,
    groups: groups,
    rounds: filteredRounds,
    matches: filteredMatches,
    matchGames: matchGames,
    participants: participants,
    prevMatches,
    siblingMatches,
  }
}

const QUALIFIER_MATCH_IDS_TO_SKIP = {
  8: new Set([]), // TODO: support
  16: new Set([14, 27, 28]),
  32: new Set([30, 59, 60]),
  64: new Set([]), // TODO: support
} as const

/**
 * A tournament is considered "started" once any match has scores or is no
 * longer in the initial Locked/Waiting/Ready states. Once started, settings
 * (teams, bracket type, team count) must not be changed.
 */
export const isTournamentStarted = (data: BracketDatabaseSnapshot | null | undefined): boolean => {
  if (!data) return false
  const matches = (data.match ?? []) as Match[]
  return matches.some((m) => {
    if (m.status === Status.Running || m.status === Status.Completed || m.status === Status.Archived) {
      return true
    }
    return m.opponent1?.score != null || m.opponent2?.score != null
  })
}

/**
 * First-time setup: creates qualifier and finals stages, then returns their data.
 */
export const createBracket = async (
  manager: BracketsManager,
  bracketType: BracketType,
  teamCount: 8 | 16 | 32 | 64,
  teams: (string | null)[]
): Promise<[BracketData, BracketData]> => {
  if (bracketType !== 'double_elimination_to_top_4') {
    throw Error('Only double_elimination_to_top_4 type supported currently')
  }

  if (teamCount !== 16 && teamCount !== 32) {
    throw Error('Only 16 or 32 teams supported currently')
  }

  const qualifierStage = await manager.create.stage({
    tournamentId: 1,
    name: 'Qualifier stage',
    type: 'double_elimination',
    seeding: teams,
    settings: { grandFinal: 'simple', balanceByes: true, size: teamCount },
  })

  const mainBracketData = await getBracketData(
    manager,
    qualifierStage.id,
    QUALIFIER_MATCH_IDS_TO_SKIP[teamCount]
  )

  const topFourTeams = getTopFourTeamsFromDoubleElimQualifiers(mainBracketData)

  const finalsStage = await manager.create.stage({
    tournamentId: 1,
    name: 'Final stage',
    type: 'single_elimination',
    seeding:
      topFourTeams.length === 4
        ? topFourTeams.map((item) => item.name)
        : [' ', '  ', '   ', '    '], // Very hacky
    settings: { grandFinal: 'simple' },
  })

  const finalsBracketData = await getBracketData(manager, finalsStage.id, new Set())

  return [mainBracketData, finalsBracketData]
}

/**
 * Fetches bracket data for existing qualifier and finals stages (no creation).
 */
export const getBracketsData = async (
  manager: BracketsManager,
  qualifierStageId: Id,
  finalsStageId: Id,
  teamCount: 8 | 16 | 32 | 64
): Promise<[BracketData, BracketData]> => {
  const [mainBracketData, finalsBracketData] = await Promise.all([
    getBracketData(manager, qualifierStageId, QUALIFIER_MATCH_IDS_TO_SKIP[teamCount]),
    getBracketData(manager, finalsStageId, new Set()),
  ])
  return [mainBracketData, finalsBracketData]
}
