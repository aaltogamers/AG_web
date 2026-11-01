'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BracketsManager } from 'brackets-manager'

import type { BracketDatabaseSnapshot, BracketStyles, Tournament } from '../types/types'
import { saveTournamentData } from '../utils/tournamentApi'
import {
  TournamentStageView,
  importTournamentData,
  loadTournamentStages,
  syncTournamentStages,
} from '../utils/tournamentStages'
import BracketsSection from './BracketsSection'
import SwissSection from './SwissSection'

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
  /** Called after the stream match ID is persisted; parent should merge `t.updated` into state. */
  onStreamMatchSaved?: (tournament: Tournament) => void
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
  onStreamMatchSaved,
  bracketStyles: bracketStylesProp,
  visibleStages,
  visibleGroups,
}: Props) => {
  // The "current" manager is rebuilt on every hydrate (a fresh in-memory
  // storage each time). We hold the latest one in a ref so mutation handlers
  // can use it without re-rendering the BracketsSection tree.
  const managerRef = useRef<BracketsManager | null>(null)

  const [data, setData] = useState<TournamentStageView[]>([])
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
      try {
        const manager = await importTournamentData(tournament)
        const newData = await loadTournamentStages(manager, tournament)
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
  }, [tournament])

  // Called by BracketGroupSection after a successful library mutation. We
  // refresh the on-screen data from the manager AND persist the full snapshot
  // to the backend so the next reader sees the new state.
  const refreshAfterMutation = useCallback(async () => {
    const manager = managerRef.current
    if (!manager) return
    try {
      await syncTournamentStages(manager, tournament, dataRef.current)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to propagate results')
    }

    const newData = await loadTournamentStages(manager, tournament)
    setData(newData)
    const snapshot = (await manager.export()) as unknown as BracketDatabaseSnapshot
    try {
      await saveTournamentData(tournament.slug, snapshot)
      onSaved?.(snapshot)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save bracket')
    }
  }, [tournament, onSaved])

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
      {visibleData.map((stage) =>
        stage.kind === 'swiss' ? (
          <SwissSection
            key={stage.data.stage.id}
            data={stage.data}
            bracketStyles={bracketStyles}
            isEditingMode={isAdmin}
            onMatchResultSaved={refreshAfterMutation}
            tournamentSlug={tournament.slug}
            onStreamMatchSaved={onStreamMatchSaved}
          />
        ) : (
          <BracketsSection
            key={stage.data.stages[0].id}
            data={stage.data}
            bracketStyles={bracketStyles}
            isEditingMode={isAdmin}
            onMatchResultSaved={refreshAfterMutation}
            visibleGroups={visibleGroups}
            tournamentSlug={tournament.slug}
            onStreamMatchSaved={onStreamMatchSaved}
          />
        )
      )}
    </div>
  )
}

export default TournamentBracketView
