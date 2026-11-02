import type { Id, Match, Participant } from 'brackets-model'
import { BracketsManager } from 'brackets-manager'
import type { Database } from 'brackets-manager'
import { InMemoryDatabase } from 'brackets-memory-db'

import type { BracketData, Tournament } from '../types/types'
import { getBracketData, getBracketsData, syncFinalsSeedingFromQualifiers } from './brackets'
import { SwissData, getSwissFormatData, syncSwissFormat } from './swiss'
import { loadChallengermodeStages } from './challengermodeStages'

export type TournamentStageView =
  | { kind: 'elimination'; data: BracketData }
  | { kind: 'swiss'; data: SwissData }
  | { kind: 'note'; text: string }

type StageSource = Pick<
  Tournament,
  'bracketType' | 'teamCount' | 'options' | 'streamMatchId' | 'data'
>

const isSwissFormat = (tournament: StageSource) =>
  tournament.bracketType === 'swiss_to_single_elimination'

export const importTournamentData = async (tournament: Tournament): Promise<BracketsManager> => {
  const manager = new BracketsManager(new InMemoryDatabase())
  await manager.import(tournament.data as unknown as Database)
  return manager
}

export const loadTournamentStages = async (
  manager: BracketsManager,
  tournament: StageSource
): Promise<TournamentStageView[]> => {
  const streamMatchId = tournament.streamMatchId ?? null
  if (isSwissFormat(tournament)) {
    const [swiss, playoffs] = await getSwissFormatData(manager, tournament.options, streamMatchId)
    return [
      { kind: 'swiss', data: swiss },
      { kind: 'elimination', data: playoffs },
    ]
  }

  const stages = (tournament.data?.stage ?? []) as { id: number }[]
  if (stages.length < 2) throw new Error('Bracket data is incomplete (missing stages).')
  const [qualifier, finals] = await getBracketsData(
    manager,
    stages[0].id,
    stages[1].id,
    tournament.teamCount,
    streamMatchId
  )
  return [
    { kind: 'elimination', data: qualifier },
    { kind: 'elimination', data: finals },
  ]
}

// Returns no manager for Challengermode tournaments, which can't be edited here
export const loadAnyTournamentStages = async (
  tournament: Tournament
): Promise<{ manager: BracketsManager | null; stages: TournamentStageView[] }> => {
  if (tournament.source === 'challengermode') {
    if (!tournament.challengermode) return { manager: null, stages: [] }
    return {
      manager: null,
      stages: loadChallengermodeStages(tournament.challengermode, tournament.streamMatchId),
    }
  }
  const manager = await importTournamentData(tournament)
  return { manager, stages: await loadTournamentStages(manager, tournament) }
}

/** Propagates results between stages after a mutation (e.g. qualifier winners into finals). */
export const syncTournamentStages = async (
  manager: BracketsManager,
  tournament: StageSource,
  current: TournamentStageView[]
) => {
  if (isSwissFormat(tournament)) {
    await syncSwissFormat(manager, tournament.options)
    return
  }

  const [qualifier, finals] = current
  if (current.length !== 2 || qualifier.kind !== 'elimination' || finals.kind !== 'elimination') {
    return
  }
  const qualifierStageId = qualifier.data.stages[0].id
  const finalsStageId = finals.data.stages[0].id
  const refreshedQualifier = await getBracketData(
    manager,
    qualifierStageId,
    tournament.teamCount,
    tournament.streamMatchId ?? null
  )
  await syncFinalsSeedingFromQualifiers(manager, refreshedQualifier, finalsStageId)
}

export const findStageMatch = (
  stages: TournamentStageView[],
  matchId: Id
): { match: Match; participants: Participant[] } | null => {
  for (const stage of stages) {
    if (stage.kind === 'note') continue
    const matches =
      stage.kind === 'swiss' ? Object.values(stage.data.matchesByRound).flat() : stage.data.matches
    const match = matches.find((m) => m.id === matchId)
    if (match) return { match, participants: stage.data.participants }
  }
  return null
}
