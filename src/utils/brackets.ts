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
    const losersGameIsBye = losersGame.opponent1 === null || losersGame.opponent2 === null
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

/**
 * Distinct placeholder names used as seeding entries in the 4-team finals
 * stage for slots whose qualifier match hasn't been decided yet. Each entry
 * must be unique (the library rejects duplicate seeding names) and visually
 * blank so the bracket renders the slot as TBD. We keep these stable across
 * re-syncs so the same placeholder participant is reused (instead of growing
 * the participants table on every update).
 */
const FINALS_TBD_PLACEHOLDERS = [' ', '  ', '   ', '    '] as const

/**
 * Returns the qualifier matches whose winners feed the finals stage, ordered
 * to match the seeding slot order (Upper-bracket qualifiers first, then
 * Lower-bracket qualifiers; ties broken by match number).
 *
 * With `inner_outer` first-round ordering (the brackets-manager default for
 * an elimination stage), 4 seeds `[A, B, C, D]` become semi-finals
 * `A vs D` and `B vs C`. With this ordering that yields the desired
 * Upper-vs-Lower cross-pairings in the finals.
 */
const getQualifierFeederMatches = (qualifierData: BracketData): Match[] => {
  const feeders = qualifierData.matches.filter((match) =>
    qualifierData.matchIds?.qualifying?.has(match.id)
  )
  feeders.sort((a, b) => {
    const groupOrderA = groupToLabel(a.group_id) === 'Upper' ? 0 : 1
    const groupOrderB = groupToLabel(b.group_id) === 'Upper' ? 0 : 1
    if (groupOrderA !== groupOrderB) return groupOrderA - groupOrderB
    return a.number - b.number
  })
  return feeders
}

const getMatchWinnerId = (match: Match): Id | null => {
  if (match.opponent1?.result === 'win') return match.opponent1.id ?? null
  if (match.opponent2?.result === 'win') return match.opponent2.id ?? null
  return null
}

/**
 * Builds the seeding (names) for the 4-team finals stage based on the
 * current qualifier results. Slots whose qualifier match isn't decided yet
 * receive a stable, distinct placeholder so the slot stays TBD (rather than
 * being treated as a BYE, which would auto-advance the opposing team).
 */
export const getFinalsSeedingNames = (qualifierData: BracketData): string[] => {
  const participantsById = getParticipantsById(qualifierData)
  const feeders = getQualifierFeederMatches(qualifierData)

  return feeders.map((match, i) => {
    const winnerId = getMatchWinnerId(match)
    if (winnerId != null) {
      const participant = participantsById[winnerId]
      if (participant) return participant.name
    }
    return FINALS_TBD_PLACEHOLDERS[i] ?? `TBD ${i + 1}`
  })
}

const MATCH_IDS = {
  // TODO: Support
  8: {
    skip: new Set<Id>([]),
    qualifying: new Set<Id>([]),
    bronze: new Set<Id>([]),
    silver: new Set<Id>([]),
    gold: new Set<Id>([]),
  },
  16: {
    skip: new Set<Id>([14, 27, 28]),
    qualifying: new Set<Id>([12, 13, 25, 26]),
    bronze: new Set<Id>([30, 31]),
    silver: new Set<Id>([32]),
    gold: new Set<Id>([32]),
  },
  32: {
    skip: new Set<Id>([30, 59, 60]),
    qualifying: new Set<Id>([28, 29, 57, 58]),
    bronze: new Set<Id>([62, 63]),
    silver: new Set<Id>([64]),
    gold: new Set<Id>([64]),
  },
  // TODO: Support
  64: {
    skip: new Set<Id>([]),
    qualifying: new Set<Id>([]),
    bronze: new Set<Id>([]),
    silver: new Set<Id>([]),
    gold: new Set<Id>([]),
  },
} as const

export const getBracketData = async (
  manager: BracketsManager,
  stageId: Id,
  teamCount: 8 | 16 | 32 | 64,
  streamMatchId: Id | null = null
): Promise<BracketData> => {
  const {
    group: groups,
    match: matches,
    match_game: matchGames,
    participant: participants,
    round: rounds,
    stage: stages,
  } = await manager.get.stageData(stageId)

  const matchIds = MATCH_IDS[teamCount]
  const matchIdsToSkip = matchIds.skip || new Set<Id>()

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
    matchIds,
    streamMatchId,
  }
}

/**
 * A tournament is considered "started" once any match has scores or is no
 * longer in the initial Locked/Waiting/Ready states. Once started, settings
 * (teams, bracket type, team count) must not be changed.
 */
export const isTournamentStarted = (data: BracketDatabaseSnapshot | null | undefined): boolean => {
  if (!data) return false
  const matches = (data.match ?? []) as Match[]
  return matches.some((m) => {
    if (
      m.status === Status.Running ||
      m.status === Status.Completed ||
      m.status === Status.Archived
    ) {
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

  const mainBracketData = await getBracketData(manager, qualifierStage.id, teamCount)

  const finalsStage = await manager.create.stage({
    tournamentId: 1,
    name: 'Final stage',
    type: 'single_elimination',
    seeding: getFinalsSeedingNames(mainBracketData),
    settings: { grandFinal: 'simple' },
  })

  const finalsBracketData = await getBracketData(manager, finalsStage.id, teamCount)

  return [mainBracketData, finalsBracketData]
}

/**
 * Re-seeds the 4-team finals stage from the current qualifier results so
 * that the qualifier winners populate the semi-final slots automatically.
 *
 * Uses `manager.update.seeding`, the library's supported way to change a
 * stage's seeding after creation: it preserves status/scores of matches
 * whose participants don't change, and throws if a finals match has already
 * started with different participants (preventing silent data loss).
 *
 * Skips work when the new seeding matches the current finals seeding to
 * avoid unnecessary stage rebuilds (e.g. after a finals-only mutation).
 *
 * Returns `true` if the seeding was actually rewritten.
 */
export const syncFinalsSeedingFromQualifiers = async (
  manager: BracketsManager,
  qualifierData: BracketData,
  finalsStageId: Id
): Promise<boolean> => {
  const feeders = getQualifierFeederMatches(qualifierData)
  if (feeders.length !== 4) return false

  const newSeedingNames = getFinalsSeedingNames(qualifierData)

  const tournamentId = qualifierData.stages[0]?.tournament_id
  if (tournamentId == null) return false

  const allParticipants = ((await manager.storage.select('participant', {
    tournament_id: tournamentId,
  })) ?? []) as Participant[]
  const participantById: Record<Id, Participant> = {}
  for (const participant of allParticipants) participantById[participant.id] = participant

  const currentSlots = await manager.get.seeding(finalsStageId)
  const currentSeedingNames = currentSlots.map((slot) =>
    slot && slot.id != null ? (participantById[slot.id]?.name ?? null) : null
  )

  const seedingUnchanged =
    currentSeedingNames.length === newSeedingNames.length &&
    currentSeedingNames.every((name, i) => name === newSeedingNames[i])
  if (seedingUnchanged) return false

  await manager.update.seeding(finalsStageId, newSeedingNames)
  return true
}

/**
 * Fetches bracket data for existing qualifier and finals stages (no creation).
 */
export const getBracketsData = async (
  manager: BracketsManager,
  qualifierStageId: Id,
  finalsStageId: Id,
  teamCount: 8 | 16 | 32 | 64,
  streamMatchId: Id | null = null
): Promise<[BracketData, BracketData]> => {
  const [mainBracketData, finalsBracketData] = await Promise.all([
    getBracketData(manager, qualifierStageId, teamCount, streamMatchId),
    getBracketData(manager, finalsStageId, teamCount, streamMatchId),
  ])
  return [mainBracketData, finalsBracketData]
}

export const teamNameToShortName = (teamName: string): string => {
  const upperCaseName = teamName.toUpperCase()

  if (teamName.length <= 3) return upperCaseName

  const split = upperCaseName.split(' ')

  if (split.length === 2 || split.length === 3) {
    return split.map((s) => s[0]).join('')
  }

  if (split.length > 3) {
    return split
      .slice(0, 3)
      .map((s) => s[0])
      .join('')
  }

  return upperCaseName.slice(0, 3)
}
