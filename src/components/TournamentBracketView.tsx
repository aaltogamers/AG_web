'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BracketsManager } from 'brackets-manager'
import type { Database } from 'brackets-manager'
import { InMemoryDatabase } from 'brackets-memory-db'

import type {
  BracketData,
  BracketDatabaseSnapshot,
  BracketStyles,
  Tournament,
} from '../types/types'
import { getBracketData, getBracketsData, syncFinalsSeedingFromQualifiers } from '../utils/brackets'
import { saveTournamentData } from '../utils/tournamentApi'
import BracketsSection from './BracketsSection'

export const defaultBracketStyles: BracketStyles = {
  textColor: '#FFFFFF',
  teamNameColor: '#33353F',
  loseScoreColor: '#AAABAD',
  winScoreColor: '#F32929',
  roundColor: '#23242D',
  dividerColor: '#1C1D26',
  connectorColor: '#F32929',
  titleFontSize: 24,
  basicFontSize: 16,
  teamHeight: 24,
  teamWidth: 140,
  teamGapX: 20,
  teamGapY: 10,
  bracketGap: 20,
}

type Props = {
  tournament: Tournament
  isAdmin: boolean
  // Called after a successful save so the parent page can re-read the
  // tournament (e.g. to flip "not started" → "started" once scores land).
  onSaved?: (snapshot: BracketDatabaseSnapshot) => void
  // Optional overrides used by stream mode.
  bracketStyles?: BracketStyles
  // Indices into the internal `data: BracketData[]` array to show. Default:
  // both stages.
  visibleStages?: number[]
  // Forwarded to BracketsSection.
  visibleGroups?: ('Upper' | 'Lower')[]
}

const TournamentBracketView = ({
  tournament,
  isAdmin,
  onSaved,
  bracketStyles: bracketStylesProp,
  visibleStages,
  visibleGroups,
}: Props) => {
  // The "current" manager is rebuilt on every hydrate (a fresh in-memory
  // storage each time). We hold the latest one in a ref so mutation handlers
  // can use it without re-rendering the BracketsSection tree.
  const managerRef = useRef<BracketsManager | null>(null)

  const [data, setData] = useState<BracketData[]>([])
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  const bracketStyles = useMemo(
    () => bracketStylesProp ?? { ...defaultBracketStyles },
    [bracketStylesProp]
  )

  const visibleData = useMemo(() => {
    if (!visibleStages || visibleStages.length === 0) return data
    return data.filter((_, i) => visibleStages.includes(i))
  }, [data, visibleStages])

  useEffect(() => {
    // Each effect run builds its own manager so concurrent hydrates (e.g.
    // React StrictMode's double-invocation in dev) can't trample one another's
    // imports of the shared in-memory storage.
    let cancelled = false
    setError(null)

    const run = async () => {
      if (!tournament.data) {
        if (!cancelled) setData([])
        return
      }
      const storage = new InMemoryDatabase()
      const manager = new BracketsManager(storage)
      try {
        await manager.import(tournament.data as unknown as Database)
        const stages = (tournament.data.stage ?? []) as { id: number }[]
        if (stages.length < 2) {
          throw new Error('Bracket data is incomplete (missing stages).')
        }
        const newData = await getBracketsData(
          manager,
          stages[0].id,
          stages[1].id,
          tournament.teamCount
        )
        if (cancelled) return
        managerRef.current = manager
        setData(newData)
      } catch (err) {
        if (cancelled) return
        console.error('[TournamentBracketView] hydrate failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to load bracket')
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [tournament.data, tournament.teamCount])

  // Called by BracketGroupSection after a successful library mutation. We
  // refresh the on-screen data from the manager AND persist the full snapshot
  // to the backend so the next reader sees the new state.
  const refreshAfterMutation = useCallback(async () => {
    const manager = managerRef.current
    if (!manager) return
    const current = dataRef.current
    if (current.length !== 2) return
    const [qualifier, finals] = current
    const qualifierStageId = qualifier.stages[0].id
    const finalsStageId = finals.stages[0].id

    // Propagate qualifier winners into the finals semi-finals before
    // re-reading. The library doesn't link stages on its own, so we re-seed
    // the finals stage from the (now mutated) qualifier results. Uses fresh
    // qualifier data, since the mutation already landed in the manager.
    try {
      const refreshedQualifier = await getBracketData(
        manager,
        qualifierStageId,
        tournament.teamCount
      )
      await syncFinalsSeedingFromQualifiers(manager, refreshedQualifier, finalsStageId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to propagate qualifier winners')
      return
    }

    const newData = await getBracketsData(
      manager,
      qualifierStageId,
      finalsStageId,
      tournament.teamCount
    )
    setData(newData)
    const snapshot = (await manager.export()) as unknown as BracketDatabaseSnapshot
    try {
      await saveTournamentData(tournament.slug, snapshot)
      onSaved?.(snapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bracket')
    }
  }, [tournament.slug, tournament.teamCount, onSaved])

  if (error) {
    return <div className="text-red text-center my-8">{error}</div>
  }

  if (!tournament.data) {
    return null
  }

  if (data.length === 0) {
    return <div className="text-center my-8 opacity-75">Loading bracket…</div>
  }

  return (
    <div className="flex flex-row overflow-x-auto">
      {visibleData.map((bracketData) => (
        <BracketsSection
          key={bracketData.stages[0].id}
          data={bracketData}
          bracketStyles={bracketStyles}
          isEditingMode={isAdmin}
          onMatchResultSaved={refreshAfterMutation}
          visibleGroups={visibleGroups}
        />
      ))}
    </div>
  )
}

export default TournamentBracketView
