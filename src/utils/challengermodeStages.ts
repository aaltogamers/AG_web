import type { Group, Id, Match, Participant, ParticipantResult, Round, Stage } from 'brackets-model'
import { Status } from 'brackets-model'

import type {
  BracketData,
  ChallengermodeBracket,
  ChallengermodeBracketKind,
  ChallengermodeSeries,
  ChallengermodeSlot,
  ChallengermodeStage,
  ChallengermodeTournament,
} from '../types/types'
import { buildSwissData, type SwissData } from './swiss'
import type { TournamentStageView } from './tournamentStages'

const TOURNAMENT_ID = 1

// Ordinals restart in every stage, so match ids on the site also encode the stage
export const CHALLENGERMODE_STAGE_ID_FACTOR = 1000

export const challengermodeMatchId = (stageIndex: number, ordinal: number) =>
  stageIndex * CHALLENGERMODE_STAGE_ID_FACTOR + ordinal

export const splitChallengermodeMatchId = (matchId: number) => ({
  stageIndex: Math.floor(matchId / CHALLENGERMODE_STAGE_ID_FACTOR),
  ordinal: matchId % CHALLENGERMODE_STAGE_ID_FACTOR,
})

type Context = {
  nextId: () => number
  participantIds: Map<string, number>
  participants: Participant[]
}

const participantIdOf = (ctx: Context, slot: ChallengermodeSlot): number => {
  let id = ctx.participantIds.get(slot.lineupId)
  if (id == null) {
    id = ctx.participantIds.size + 1
    ctx.participantIds.set(slot.lineupId, id)
    ctx.participants.push({ id, tournament_id: TOURNAMENT_ID, name: slot.name })
  }
  return id
}

const isFinished = (series: ChallengermodeSeries) =>
  series.state === 'COMPLETED' || series.state === 'NULLIFIED'

const toStatus = (series: ChallengermodeSeries): Status => {
  if (series.state === 'RUNNING' || series.state === 'PAUSED') return Status.Running
  if (isFinished(series)) return Status.Completed
  return series.slots[0] && series.slots[1] ? Status.Ready : Status.Waiting
}

const toOpponent = (ctx: Context, slot: ChallengermodeSlot): ParticipantResult => ({
  id: participantIdOf(ctx, slot),
  ...(slot.score != null ? { score: slot.score } : {}),
  ...(slot.result ? { result: slot.result } : {}),
})

const filledCount = (series: ChallengermodeSeries) => series.slots.filter(Boolean).length

const lineupOf = (series: ChallengermodeSeries, outcome: 'winner' | 'loser'): string | null => {
  const wanted = outcome === 'winner' ? 'win' : 'loss'
  return series.slots.find((s) => s?.result === wanted)?.lineupId ?? null
}

const isByeSeries = (series: ChallengermodeSeries) =>
  filledCount(series) === 1 && (isFinished(series) || lineupOf(series, 'winner') != null)

type DropOrder = 'natural' | 'reverse'
type SlotSource = {
  kind: ChallengermodeBracketKind
  round: number
  index: number
  outcome: 'winner' | 'loser'
}

type TreeBrackets = Partial<Record<ChallengermodeBracketKind, ChallengermodeBracket>>

const roundOf = (brackets: TreeBrackets, kind: ChallengermodeBracketKind, round: number) =>
  brackets[kind]?.rounds[round]?.series ?? null

const seriesAt = (brackets: TreeBrackets, source: SlotSource) =>
  roundOf(brackets, source.kind, source.round)?.[source.index] ?? null

const isDropRound = (lowerRound: number) => lowerRound === 0 || lowerRound % 2 === 1

const dropSource = (
  brackets: TreeBrackets,
  lowerRound: number,
  index: number,
  slot: 0 | 1,
  order: DropOrder
): SlotSource | null => {
  const lower = roundOf(brackets, 'lower', lowerRound)
  if (!lower) return null
  const count = lower.length
  const pick = order === 'natural' ? index : count - 1 - index
  if (lowerRound === 0) {
    const upper = roundOf(brackets, 'upper', 0)
    if (upper?.length !== count * 2) return null
    return { kind: 'upper', round: 0, index: pick * 2 + slot, outcome: 'loser' }
  }
  if (slot !== 0) return null
  const upperRound = (lowerRound + 1) / 2
  if (roundOf(brackets, 'upper', upperRound)?.length !== count) return null
  return { kind: 'upper', round: upperRound, index: pick, outcome: 'loser' }
}

const winnerSource = (
  brackets: TreeBrackets,
  kind: ChallengermodeBracketKind,
  round: number,
  index: number,
  slot: 0 | 1
): SlotSource | null => {
  if (kind === 'final') {
    if (round !== 0) return null
    const feeder: ChallengermodeBracketKind = slot === 0 ? 'upper' : 'lower'
    const last = (brackets[feeder]?.rounds.length ?? 0) - 1
    return last >= 0 ? { kind: feeder, round: last, index: 0, outcome: 'winner' } : null
  }
  if (round === 0) return null
  const current = roundOf(brackets, kind, round)
  const previous = roundOf(brackets, kind, round - 1)
  if (!current || !previous) return null
  if (previous.length === current.length * 2) {
    return { kind, round: round - 1, index: index * 2 + slot, outcome: 'winner' }
  }
  if (kind === 'lower' && previous.length === current.length && slot === 1) {
    return { kind, round: round - 1, index, outcome: 'winner' }
  }
  return null
}

// CM's drop-in order alternates per round, counted from the last drop round (seen on 8 and 16 team brackets)
const guessDropOrders = (brackets: TreeBrackets): Record<number, DropOrder> => {
  const rounds = brackets.lower?.rounds ?? []
  const dropRounds = rounds
    .map((r, i) => ({ i, count: r.series.length }))
    .filter(({ i, count }) => isDropRound(i) && count > 1)
    .map(({ i }) => i)
  const orders: Record<number, DropOrder> = {}
  dropRounds.reverse().forEach((i, n) => (orders[i] = n % 2 === 0 ? 'natural' : 'reverse'))
  return orders
}

// Picks the drop-in order that agrees with known results; null when neither does
const detectDropOrders = (brackets: TreeBrackets): Record<number, DropOrder | null> => {
  const guesses = guessDropOrders(brackets)
  const orders: Record<number, DropOrder | null> = {}
  ;(brackets.lower?.rounds ?? []).forEach((round, i) => {
    if (!isDropRound(i)) return
    const score = (order: DropOrder) => {
      let agree = 0
      let disagree = 0
      round.series.forEach((series, index) => {
        if (filledCount(series) === 1 && !isFinished(series)) return
        ;([0, 1] as const).forEach((slot) => {
          const source = dropSource(brackets, i, index, slot, order)
          const from = source && seriesAt(brackets, source)
          const expected = from && lineupOf(from, 'loser')
          const actual = series.slots[slot]?.lineupId
          if (!expected || !actual) return
          if (expected === actual) agree++
          else disagree++
        })
      })
      return { agree, disagree }
    }
    const guess = guesses[i] ?? 'natural'
    const other: DropOrder = guess === 'natural' ? 'reverse' : 'natural'
    const a = score(guess)
    const b = score(other)
    if (a.disagree === 0) orders[i] = guess
    else if (b.disagree === 0 && b.agree > 0) orders[i] = other
    else orders[i] = null
  })
  return orders
}

const slotSource = (
  brackets: TreeBrackets,
  orders: Record<number, DropOrder | null>,
  kind: ChallengermodeBracketKind,
  round: number,
  index: number,
  slot: 0 | 1
): SlotSource | null => {
  if (kind === 'lower' && isDropRound(round) && (round === 0 || slot === 0)) {
    const order = orders[round]
    return order ? dropSource(brackets, round, index, slot, order) : null
  }
  return winnerSource(brackets, kind, round, index, slot)
}

// A half-filled upcoming series only lists the team that is already known; put it in the slot it comes from
const placeHalfFilled = (
  brackets: TreeBrackets,
  orders: Record<number, DropOrder | null>,
  kind: ChallengermodeBracketKind,
  round: number,
  index: number,
  series: ChallengermodeSeries
): ChallengermodeSeries['slots'] => {
  if (filledCount(series) !== 1 || isByeSeries(series)) return series.slots
  const present = series.slots[0] ?? series.slots[1]!
  const comesFrom = (slot: 0 | 1) => {
    const source = slotSource(brackets, orders, kind, round, index, slot)
    const from = source && seriesAt(brackets, source)
    return !!from && lineupOf(from, source.outcome) === present.lineupId
  }
  if (series.slots[0] && comesFrom(1) && !comesFrom(0)) return [null, present]
  if (series.slots[1] && comesFrom(0) && !comesFrom(1)) return [present, null]
  return series.slots
}

const buildElimination = (
  ctx: Context,
  stage: ChallengermodeStage,
  stageIndex: number,
  isLastStage: boolean,
  streamMatchId: Id | null
): BracketData => {
  const isDouble = stage.format === 'DOUBLE_ELIMINATION'
  const stageRow: Stage = {
    id: ctx.nextId(),
    tournament_id: TOURNAMENT_ID,
    name: `Stage ${stageIndex + 1}`,
    type: isDouble ? 'double_elimination' : 'single_elimination',
    number: stageIndex + 1,
    settings: {},
  }
  const upperGroup: Group = { id: ctx.nextId(), stage_id: stageRow.id, number: 1 }
  const lowerGroup: Group = { id: ctx.nextId(), stage_id: stageRow.id, number: 2 }
  const groups = isDouble ? [upperGroup, lowerGroup] : [upperGroup]

  const brackets: TreeBrackets = {}
  for (const bracket of stage.brackets) brackets[bracket.kind] ??= bracket
  const orders = detectDropOrders(brackets)

  const rounds: Round[] = []
  const matches: Match[] = []
  const matchNumbers: Record<Id, number> = {}
  const roundTitles: Record<Id, string> = {}
  const bestOfByRoundId: Record<Id, number> = {}
  const roundIdsByGroup: Record<Id, Id[]> = { [upperGroup.id]: [], [lowerGroup.id]: [] }
  const matchAt: Partial<Record<ChallengermodeBracketKind, Match[][]>> = {}
  const pendingDrops: { match: Match; slot: 0 | 1; source: SlotSource }[] = []

  const kinds: ChallengermodeBracketKind[] = ['single', 'upper', 'final', 'lower']
  for (const kind of kinds) {
    const bracket = brackets[kind]
    if (!bracket) continue
    const group = kind === 'lower' ? lowerGroup : upperGroup
    matchAt[kind] = bracket.rounds.map((cmRound, roundIndex) => {
      const round: Round = {
        id: ctx.nextId(),
        stage_id: stageRow.id,
        group_id: group.id,
        number: roundIdsByGroup[group.id].length + 1,
      }
      rounds.push(round)
      roundIdsByGroup[group.id].push(round.id)
      roundTitles[round.id] =
        kind === 'final' && cmRound.title === 'Finals' ? 'Grand final' : cmRound.title
      bestOfByRoundId[round.id] = Math.max(1, ...cmRound.series.map((s) => s.bestOf))

      return cmRound.series.map((series, index) => {
        const slots = placeHalfFilled(brackets, orders, kind, roundIndex, index, series)
        const id = challengermodeMatchId(stageIndex, series.ordinal)
        matchNumbers[id] = series.ordinal
        const match: Match = {
          id,
          stage_id: stageRow.id,
          group_id: group.id,
          round_id: round.id,
          number: index + 1,
          child_count: 0,
          status: toStatus(series),
          opponent1: null,
          opponent2: null,
        }
        ;([0, 1] as const).forEach((slot) => {
          const filled = slots[slot]
          const key = slot === 0 ? 'opponent1' : 'opponent2'
          if (filled) {
            match[key] = toOpponent(ctx, filled)
            return
          }
          const source = slotSource(brackets, orders, kind, roundIndex, index, slot)
          const from = source && seriesAt(brackets, source)
          const fedByBye = !!from && source.outcome === 'loser' && isByeSeries(from)
          const isBye =
            isFinished(series) ||
            fedByBye ||
            (roundIndex === 0 &&
              (kind === 'single' || kind === 'upper') &&
              filledCount(series) === 1)
          match[key] = isBye ? null : { id: null }
          if (!isBye && source && source.outcome === 'loser') {
            pendingDrops.push({ match, slot, source })
          }
        })
        matches.push(match)
        return match
      })
    })
  }

  const prevMatches: BracketData['prevMatches'] = {}
  for (const { match, slot, source } of pendingDrops) {
    const from = matchAt[source.kind]?.[source.round]?.[source.index]
    if (!from) continue
    prevMatches[match.id] = {
      ...prevMatches[match.id],
      [slot === 0 ? 'opponent1From' : 'opponent2From']: { match: from, outcome: 'loser' },
    }
  }

  const siblingMatches: BracketData['siblingMatches'] = {}
  for (const kind of kinds) {
    const byRound = matchAt[kind] ?? []
    byRound.forEach((roundMatches, r) => {
      const next = byRound[r + 1]
      if (!next || roundMatches.length !== next.length * 2) return
      for (let i = 0; i + 1 < roundMatches.length; i += 2) {
        siblingMatches[roundMatches[i].id] = roundMatches[i + 1]
        siblingMatches[roundMatches[i + 1].id] = roundMatches[i]
      }
    })
  }

  const finalKind: ChallengermodeBracketKind = isDouble ? 'final' : 'single'
  const finalRound = brackets[finalKind]?.rounds.at(-1)
  const finalIds = isLastStage
    ? (finalRound?.series ?? [])
        .filter((s) => !s.labels.includes('BRONZE_MATCH'))
        .map((s) => challengermodeMatchId(stageIndex, s.ordinal))
    : []

  const stageParticipantIds = new Set(
    matches.flatMap((m) => [m.opponent1?.id, m.opponent2?.id]).filter((id) => id != null)
  )

  return {
    stages: [stageRow],
    groups,
    rounds,
    matches,
    matchGames: [],
    participants: ctx.participants.filter((p) => stageParticipantIds.has(p.id)),
    prevMatches,
    siblingMatches,
    matchIds: {
      skip: new Set(),
      qualifying: new Set(),
      bronze: new Set(),
      silver: new Set(finalIds),
      gold: new Set(finalIds),
    },
    streamMatchId,
    bestOfByRoundId,
    matchNumbers,
    roundTitles,
  }
}

const buildSwiss = (
  ctx: Context,
  stage: ChallengermodeStage,
  stageIndex: number,
  advanceCount: number,
  streamMatchId: Id | null
): SwissData => {
  const stageRow: Stage = {
    id: ctx.nextId(),
    tournament_id: TOURNAMENT_ID,
    name: `Stage ${stageIndex + 1}`,
    type: 'round_robin',
    number: stageIndex + 1,
    settings: {},
  }
  const group: Group = { id: ctx.nextId(), stage_id: stageRow.id, number: 1 }
  const cmRounds = stage.brackets[0]?.rounds ?? []
  const rounds: Round[] = []
  const matchesByRound: Record<Id, Match[]> = {}
  const matchNumbers: Record<Id, number> = {}
  const seeds = new Map<number, number>()

  cmRounds.forEach((cmRound, roundIndex) => {
    const round: Round = {
      id: ctx.nextId(),
      stage_id: stageRow.id,
      group_id: group.id,
      number: roundIndex + 1,
    }
    rounds.push(round)
    matchesByRound[round.id] = cmRound.series.map((series, index) => {
      const id = challengermodeMatchId(stageIndex, series.ordinal)
      matchNumbers[id] = series.ordinal
      const teams = series.slots.filter((s): s is ChallengermodeSlot => s != null)
      for (const team of teams) {
        const pid = participantIdOf(ctx, team)
        if (!seeds.has(pid)) seeds.set(pid, team.seed ?? Number.MAX_SAFE_INTEGER)
      }
      const isBye = teams.length === 1
      return {
        id,
        stage_id: stageRow.id,
        group_id: group.id,
        round_id: round.id,
        number: index + 1,
        child_count: 0,
        status: toStatus(series),
        opponent1: teams[0] ? toOpponent(ctx, teams[0]) : { id: null },
        opponent2: isBye ? null : teams[1] ? toOpponent(ctx, teams[1]) : { id: null },
      }
    })
  })

  const seedIds = [...seeds.entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([id]) => id)

  return buildSwissData(
    {
      stage: stageRow,
      rounds,
      matchesByRound,
      participants: ctx.participants.filter((p) => seeds.has(Number(p.id))),
      seedIds,
    },
    { advanceCount, streamMatchId, roundCount: stage.roundCount, matchNumbers }
  )
}

// Standings use our own tiebreakers, so once the next stage is seeded, the teams that really advanced go on top
const markAdvancing = (
  ctx: Context,
  data: SwissData,
  nextStage: ChallengermodeStage | undefined
): SwissData => {
  const advancing = new Set<Id>()
  for (const bracket of nextStage?.brackets ?? []) {
    for (const round of bracket.rounds) {
      for (const series of round.series) {
        for (const slot of series.slots) {
          const id = slot && ctx.participantIds.get(slot.lineupId)
          if (id != null) advancing.add(id)
        }
      }
    }
  }
  if (advancing.size === 0) return data
  const standings = [
    ...data.standings.filter((s) => advancing.has(s.participantId)),
    ...data.standings.filter((s) => !advancing.has(s.participantId)),
  ].map((s, i) => ({ ...s, rank: i + 1 }))
  return { ...data, standings, advanceCount: advancing.size }
}

export const loadChallengermodeStages = (
  tournament: ChallengermodeTournament,
  streamMatchId: Id | null
): TournamentStageView[] => {
  let id = 0
  const ctx: Context = { nextId: () => ++id, participantIds: new Map(), participants: [] }
  const { stages } = tournament

  return stages.map((stage, stageIndex): TournamentStageView => {
    const isLastStage = stageIndex === stages.length - 1
    if (stage.format === 'SWISS') {
      if (!stage.brackets[0]?.rounds.length) {
        return { kind: 'note', text: 'Swiss stage: pairings appear here once it starts.' }
      }
      const nextStage = stages[stageIndex + 1]
      const data = buildSwiss(ctx, stage, stageIndex, nextStage?.lineupCount ?? 0, streamMatchId)
      return { kind: 'swiss', data: markAdvancing(ctx, data, nextStage) }
    }
    if (stage.format === 'SINGLE_ELIMINATION' || stage.format === 'DOUBLE_ELIMINATION') {
      return {
        kind: 'elimination',
        data: buildElimination(ctx, stage, stageIndex, isLastStage, streamMatchId),
      }
    }
    return {
      kind: 'note',
      text: `Stage ${stageIndex + 1}: this stage type can only be viewed on Challengermode.`,
    }
  })
}
