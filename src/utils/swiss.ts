import type { Id, Match, Participant, Round, Stage } from 'brackets-model'
import { Status } from 'brackets-model'
import { BracketsManager } from 'brackets-manager'

import type { BracketData, TournamentOptions } from '../types/types'
import { getEliminationBracketData } from './brackets'

const TOURNAMENT_ID = 1

export type SwissRecord = { wins: number; losses: number }

export type SwissStanding = SwissRecord & {
  participantId: Id
  seed: number
  buchholz: number
  roundDiff: number
  rank: number
}

export type SwissData = {
  manager: BracketsManager
  stage: Stage
  rounds: Round[]
  matchesByRound: Record<Id, Match[]>
  participants: Participant[]
  standings: SwissStanding[]
  recordsBeforeRound: Record<Id, Record<Id, SwissRecord>>
  advanceCount: number
  isComplete: boolean
  matchIds: BracketData['matchIds']
  streamMatchId: Id | null
}

type TeamState = SwissRecord & { seed: number; opponents: Id[]; byes: number; roundDiff: number }

type SwissStage = {
  stage: Stage
  rounds: Round[]
  matchesByRound: Record<Id, Match[]>
  participants: Participant[]
  seedIds: Id[]
}

type Pairing = { pairs: [Id, Id][]; byeId: Id | null }

const emptyMatchIds = (): BracketData['matchIds'] => ({
  skip: new Set(),
  qualifying: new Set(),
  bronze: new Set(),
  silver: new Set(),
  gold: new Set(),
})

export const isSwissBye = (match: Match) => match.opponent2 === null

const isPaired = (match: Match) => match.opponent1?.id != null

export const getSwissWinnerId = (match: Match): Id | null => {
  if (isSwissBye(match)) return match.opponent1?.id ?? null
  if (match.opponent1?.result === 'win') return match.opponent1.id ?? null
  if (match.opponent2?.result === 'win') return match.opponent2.id ?? null
  return null
}

const isMatchStarted = (match: Match) =>
  match.opponent1 !== null &&
  match.opponent2 !== null &&
  (match.status === Status.Running ||
    match.status === Status.Completed ||
    match.status === Status.Archived ||
    match.opponent1?.score != null ||
    match.opponent2?.score != null)

const getStageIds = async (manager: BracketsManager) => {
  const stages = ((await manager.storage.select('stage', { tournament_id: TOURNAMENT_ID })) ??
    []) as Stage[]
  const swiss = stages.find((s) => s.type === 'round_robin')
  const playoffs = stages.find((s) => s.type === 'single_elimination')
  if (!swiss || !playoffs) throw new Error('Bracket data is incomplete (missing stages).')
  return { swissStageId: swiss.id, playoffStageId: playoffs.id }
}

const loadSwissStage = async (manager: BracketsManager, stageId: Id): Promise<SwissStage> => {
  const data = await manager.get.stageData(stageId)
  const rounds = [...data.round].sort((a, b) => a.number - b.number)
  const matchesByRound: Record<Id, Match[]> = {}
  for (const round of rounds) matchesByRound[round.id] = []
  for (const match of data.match) matchesByRound[match.round_id]?.push(match)
  for (const round of rounds) matchesByRound[round.id].sort((a, b) => a.number - b.number)

  const seedIds = (matchesByRound[rounds[0]?.id] ?? [])
    .flatMap((m) => [m.opponent1?.id, m.opponent2?.id])
    .filter((id): id is Id => id != null)
    .sort((a, b) => Number(a) - Number(b))

  return { stage: data.stage[0], rounds, matchesByRound, participants: data.participant, seedIds }
}

const computeTeamStates = (swiss: SwissStage, roundCount: number): Map<Id, TeamState> => {
  const states = new Map<Id, TeamState>()
  swiss.seedIds.forEach((id, seed) =>
    states.set(id, { wins: 0, losses: 0, seed, opponents: [], byes: 0, roundDiff: 0 })
  )
  for (const round of swiss.rounds.slice(0, roundCount)) {
    for (const match of swiss.matchesByRound[round.id]) {
      if (!isPaired(match)) continue
      const winnerId = getSwissWinnerId(match)
      if (isSwissBye(match)) {
        const team = states.get(match.opponent1!.id!)
        if (team && winnerId != null) {
          team.wins++
          team.byes++
        }
        continue
      }
      const id1 = match.opponent1!.id!
      const id2 = match.opponent2!.id!
      states.get(id1)?.opponents.push(id2)
      states.get(id2)?.opponents.push(id1)
      if (winnerId == null) continue
      const loserId = winnerId === id1 ? id2 : id1
      const diff = Math.abs((match.opponent1?.score ?? 0) - (match.opponent2?.score ?? 0))
      states.get(winnerId)!.wins++
      states.get(winnerId)!.roundDiff += diff
      states.get(loserId)!.losses++
      states.get(loserId)!.roundDiff -= diff
    }
  }
  return states
}

const rankTeams = (states: Map<Id, TeamState>): SwissStanding[] => {
  const standings = [...states.entries()].map(([participantId, s]) => ({
    participantId,
    seed: s.seed,
    wins: s.wins,
    losses: s.losses,
    buchholz: s.opponents.reduce<number>((sum, opp) => sum + (states.get(opp)?.wins ?? 0), 0),
    roundDiff: s.roundDiff,
    rank: 0,
  }))
  standings.sort(
    (a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.buchholz - a.buchholz ||
      b.roundDiff - a.roundDiff ||
      a.seed - b.seed
  )
  standings.forEach((s, i) => (s.rank = i + 1))
  return standings
}

const PAIRING_SEARCH_BUDGET = 200_000

const findPairs = (
  order: Id[],
  states: Map<Id, TeamState>,
  avoidRematches: boolean
): [Id, Id][] | null => {
  let budget = PAIRING_SEARCH_BUDGET
  const wins = (id: Id) => states.get(id)!.wins
  const played = (a: Id, b: Id) => states.get(a)!.opponents.includes(b)

  const solve = (remaining: Id[]): [Id, Id][] | null => {
    if (remaining.length === 0) return []
    if (--budget < 0) return null
    const [team, ...rest] = remaining
    const sameGroup = rest.filter((c) => wins(c) === wins(team))
    // Dutch system: the top team of a score group plays the top team of the group's lower half.
    const ideal = Math.floor((sameGroup.length + 1) / 2) - 1
    const candidates = [
      ...sameGroup
        .map((c, i) => ({ c, i, d: Math.abs(i - ideal) }))
        .sort((a, b) => a.d - b.d || b.i - a.i)
        .map((x) => x.c),
      ...rest.filter((c) => wins(c) !== wins(team)),
    ]
    for (const candidate of candidates) {
      if (avoidRematches && played(team, candidate)) continue
      const result = solve(rest.filter((c) => c !== candidate))
      if (result) return [[team, candidate], ...result]
    }
    return null
  }

  return solve(order)
}

const computePairing = (states: Map<Id, TeamState>): Pairing => {
  const order = rankTeams(states).map((s) => s.participantId)
  let byeId: Id | null = null
  if (order.length % 2 === 1) {
    const reversed = [...order].reverse()
    byeId = reversed.find((id) => states.get(id)!.byes === 0) ?? reversed[0]
  }
  const toPair = order.filter((id) => id !== byeId)
  const pairs = findPairs(toPair, states, true) ?? findPairs(toPair, states, false) ?? []
  return { pairs, byeId }
}

const writePairing = async (
  manager: BracketsManager,
  matches: Match[],
  pairing: Pairing | null
) => {
  const regular = matches.filter((m) => !isSwissBye(m))
  for (const [i, match] of regular.entries()) {
    const pair = pairing?.pairs[i]
    await manager.storage.update('match', match.id, {
      ...match,
      status: pair ? Status.Ready : Status.Locked,
      opponent1: { id: pair?.[0] ?? null },
      opponent2: { id: pair?.[1] ?? null },
    })
  }
  const bye = matches.find((m) => isSwissBye(m))
  if (bye) {
    const byeId = pairing?.byeId ?? null
    await manager.storage.update('match', bye.id, {
      ...bye,
      status: byeId != null ? Status.Ready : Status.Locked,
      opponent1: { id: byeId },
      opponent2: null,
    })
  }
}

const isRoundDone = (swiss: SwissStage, round: Round) =>
  swiss.matchesByRound[round.id].every((m) => getSwissWinnerId(m) != null)

const syncSwissPairings = async (manager: BracketsManager, swissStageId: Id) => {
  const swiss = await loadSwissStage(manager, swissStageId)
  for (let r = 1; r < swiss.rounds.length; r++) {
    const matches = swiss.matchesByRound[swiss.rounds[r].id]
    const previousDone = swiss.rounds.slice(0, r).every((prev) => isRoundDone(swiss, prev))
    const paired = matches.some(isPaired)
    if (!previousDone) {
      if (paired && !matches.some(isMatchStarted)) await writePairing(manager, matches, null)
      continue
    }
    // Once paired, a round keeps its pairing; it's only cleared when an earlier winner changes.
    if (!paired) await writePairing(manager, matches, computePairing(computeTeamStates(swiss, r)))
  }
}

const clearLaterRounds = async (manager: BracketsManager, match: Match) => {
  const swiss = await loadSwissStage(manager, match.stage_id)
  const roundNumber = swiss.rounds.find((r) => r.id === match.round_id)?.number ?? 0
  for (const round of swiss.rounds) {
    if (round.number <= roundNumber) continue
    const matches = swiss.matchesByRound[round.id]
    if (matches.some(isPaired)) await writePairing(manager, matches, null)
  }
}

const havePlayoffsStarted = async (manager: BracketsManager) => {
  const { playoffStageId } = await getStageIds(manager)
  return (await manager.get.stageData(playoffStageId)).match.some(isMatchStarted)
}

const getPlaceholderIds = (swiss: SwissStage, advanceCount: number): Id[] => {
  const seeds = new Set(swiss.seedIds)
  return swiss.participants
    .map((p) => p.id)
    .filter((id) => !seeds.has(id))
    .sort((a, b) => Number(a) - Number(b))
    .slice(0, advanceCount)
}

const syncPlayoffSeeding = async (
  manager: BracketsManager,
  swissStageId: Id,
  playoffStageId: Id,
  advanceCount: number
) => {
  if (await havePlayoffsStarted(manager)) return
  const swiss = await loadSwissStage(manager, swissStageId)
  const isComplete = swiss.rounds.every((round) => isRoundDone(swiss, round))
  const target = isComplete
    ? rankTeams(computeTeamStates(swiss, swiss.rounds.length))
        .slice(0, advanceCount)
        .map((s) => s.participantId)
    : getPlaceholderIds(swiss, advanceCount)
  const current = (await manager.get.seeding(playoffStageId)).map((slot) => slot?.id ?? null)
  if (JSON.stringify(current) === JSON.stringify(target)) return
  await manager.update.seedingIds(playoffStageId, target)
}

export const syncSwissFormat = async (manager: BracketsManager, options: TournamentOptions) => {
  const { swissStageId, playoffStageId } = await getStageIds(manager)
  await syncSwissPairings(manager, swissStageId)
  await syncPlayoffSeeding(manager, swissStageId, playoffStageId, options.advanceCount)
}

const assertResultChangeable = async (
  manager: BracketsManager,
  match: Match,
  winnerChanges: boolean
) => {
  if (await havePlayoffsStarted(manager)) {
    throw new Error('The playoffs have already started. Reset them first to change Swiss results.')
  }
  if (!winnerChanges) return
  const swiss = await loadSwissStage(manager, match.stage_id)
  const roundNumber = swiss.rounds.find((r) => r.id === match.round_id)?.number ?? 0
  for (const round of swiss.rounds) {
    if (round.number <= roundNumber) continue
    if (swiss.matchesByRound[round.id].some(isMatchStarted)) {
      throw new Error(
        `Swiss round ${round.number} already has results. Reset those first to change this result.`
      )
    }
  }
}

const getPlayableSwissMatch = async (manager: BracketsManager, matchId: Id) => {
  const match = (await manager.storage.select('match', matchId)) as Match | null
  if (!match) throw new Error('Match not found.')
  if (isSwissBye(match) || match.opponent1?.id == null || match.opponent2?.id == null) {
    throw new Error('This match has no opponents yet.')
  }
  return match
}

export const updateSwissMatchResult = async (
  manager: BracketsManager,
  {
    matchId,
    score1,
    score2,
    inProgress,
  }: { matchId: Id; score1: number; score2: number; inProgress: boolean }
) => {
  const match = await getPlayableSwissMatch(manager, matchId)
  if (!inProgress && score1 === score2) throw new Error('A Swiss match cannot end in a draw.')

  const newWinnerId = inProgress
    ? null
    : score1 > score2
      ? match.opponent1!.id
      : match.opponent2!.id
  const winnerChanges = newWinnerId !== getSwissWinnerId(match)
  await assertResultChangeable(manager, match, winnerChanges)

  const result = (won: boolean) =>
    inProgress ? undefined : won ? ('win' as const) : ('loss' as const)
  await manager.storage.update('match', match.id, {
    ...match,
    status: inProgress ? Status.Running : Status.Completed,
    opponent1: { id: match.opponent1!.id, score: score1, result: result(score1 > score2) },
    opponent2: { id: match.opponent2!.id, score: score2, result: result(score2 > score1) },
  })
  if (winnerChanges) await clearLaterRounds(manager, match)
}

export const resetSwissMatchResult = async (manager: BracketsManager, matchId: Id) => {
  const match = await getPlayableSwissMatch(manager, matchId)
  const winnerChanges = getSwissWinnerId(match) != null
  await assertResultChangeable(manager, match, winnerChanges)
  await manager.storage.update('match', match.id, {
    ...match,
    status: Status.Ready,
    opponent1: { id: match.opponent1!.id },
    opponent2: { id: match.opponent2!.id },
  })
  if (winnerChanges) await clearLaterRounds(manager, match)
}

export const getSwissTeamNames = (teams: (string | null)[]): string[] =>
  teams.map((t) => t?.trim() ?? '').filter((t) => t !== '')

export const createSwissBracket = async (
  manager: BracketsManager,
  teams: (string | null)[],
  options: TournamentOptions
) => {
  const names = getSwissTeamNames(teams)
  const { swissRounds, advanceCount } = options
  if (names.length < advanceCount) {
    throw new Error(`At least ${advanceCount} teams are needed, since ${advanceCount} advance.`)
  }
  if (new Set(names).size !== names.length) throw new Error('Team names must be unique.')

  for (const name of names) {
    await manager.storage.insert('participant', { tournament_id: TOURNAMENT_ID, name })
  }
  const placeholderIds: Id[] = []
  for (let i = 1; i <= advanceCount; i++) {
    placeholderIds.push(
      await manager.storage.insert('participant', {
        tournament_id: TOURNAMENT_ID,
        name: `Swiss #${i}`,
      })
    )
  }

  const stageId = await manager.storage.insert('stage', {
    tournament_id: TOURNAMENT_ID,
    name: 'Swiss stage',
    type: 'round_robin',
    number: 1,
    settings: { size: names.length },
  })
  const groupId = await manager.storage.insert('group', { stage_id: stageId, number: 1 })
  const matchCount = Math.ceil(names.length / 2)
  const hasBye = names.length % 2 === 1
  for (let r = 1; r <= swissRounds; r++) {
    const roundId = await manager.storage.insert('round', {
      stage_id: stageId,
      group_id: groupId,
      number: r,
    })
    for (let i = 1; i <= matchCount; i++) {
      await manager.storage.insert('match', {
        stage_id: stageId,
        group_id: groupId,
        round_id: roundId,
        number: i,
        child_count: 0,
        status: Status.Locked,
        opponent1: { id: null },
        opponent2: hasBye && i === matchCount ? null : { id: null },
      })
    }
  }

  const swiss = await loadSwissStage(manager, stageId)
  const allIds = (
    ((await manager.storage.select('participant', { tournament_id: TOURNAMENT_ID })) ??
      []) as Participant[]
  )
    .map((p) => p.id)
    .filter((id) => !placeholderIds.includes(id))
  const states = new Map<Id, TeamState>(
    allIds.map((id, seed) => [
      id,
      { wins: 0, losses: 0, seed, opponents: [], byes: 0, roundDiff: 0 },
    ])
  )
  await writePairing(manager, swiss.matchesByRound[swiss.rounds[0].id], computePairing(states))

  await manager.create.stage({
    tournamentId: TOURNAMENT_ID,
    name: 'Playoffs',
    type: 'single_elimination',
    seedingIds: placeholderIds,
    settings: { size: advanceCount },
  })
}

export const getSwissFormatData = async (
  manager: BracketsManager,
  options: TournamentOptions,
  streamMatchId: Id | null
): Promise<[SwissData, BracketData]> => {
  const { swissStageId, playoffStageId } = await getStageIds(manager)
  const swiss = await loadSwissStage(manager, swissStageId)

  const recordsBeforeRound: Record<Id, Record<Id, SwissRecord>> = {}
  swiss.rounds.forEach((round, r) => {
    const records: Record<Id, SwissRecord> = {}
    computeTeamStates(swiss, r).forEach(({ wins, losses }, id) => (records[id] = { wins, losses }))
    recordsBeforeRound[round.id] = records
  })

  const swissData: SwissData = {
    manager,
    stage: swiss.stage,
    rounds: swiss.rounds,
    matchesByRound: swiss.matchesByRound,
    participants: swiss.participants,
    standings: rankTeams(computeTeamStates(swiss, swiss.rounds.length)),
    recordsBeforeRound,
    advanceCount: options.advanceCount,
    isComplete: swiss.rounds.every((round) => isRoundDone(swiss, round)),
    matchIds: emptyMatchIds(),
    streamMatchId,
  }

  const playoffStage = await manager.get.stageData(playoffStageId)
  const lastRound = [...playoffStage.round].sort((a, b) => b.number - a.number)[0]
  const finalMatchIds = playoffStage.match
    .filter((m) => m.round_id === lastRound?.id)
    .map((m) => m.id)
  const playoffData = await getEliminationBracketData(
    manager,
    playoffStageId,
    { ...emptyMatchIds(), silver: new Set(finalMatchIds), gold: new Set(finalMatchIds) },
    streamMatchId,
    {
      bestOfByRoundId: lastRound ? { [lastRound.id]: options.finalBestOf } : {},
      placeholderParticipantIds: new Set(getPlaceholderIds(swiss, options.advanceCount)),
      roundNumberOffset: swiss.rounds.length,
    }
  )

  return [swissData, playoffData]
}
