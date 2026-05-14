'use client'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import PageWrapper from '../../components/PageWrapper'
import TournamentBracketView, {
  defaultBracketStyles,
} from '../../components/TournamentBracketView'
import TournamentSetup from '../../components/TournamentSetup'
import { Tournament, getBracketTypeLabel } from '../../types/types'
import { checkAdminSession } from '../../utils/adminAuth'
import { getTournament, getTournamentUpdatedAt, updateTournament } from '../../utils/tournamentApi'
import makeBackgroundInvisible from '../../utils/makeBackgroundInvisible'
import {
  isStreamMode,
  parseStreamBracketStyles,
  parseStreamStageFilter,
} from '../../utils/streamMode'

const TournamentPage = () => {
  const router = useRouter()
  const rawSlug = router.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingSettings, setEditingSettings] = useState(false)
  const [restarting, setRestarting] = useState(false)

  const streamMode = router.isReady && isStreamMode(router.query)

  const lastServerUpdatedAtRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!slug) return
    const t = await getTournament(slug)
    if (!t) {
      setNotFound(true)
      setLoading(false)
      return
    }
    lastServerUpdatedAtRef.current = t.updatedAt
    setTournament(t)
    setLoading(false)
  }, [slug])

  useEffect(() => {
    if (!router.isReady) return
    setLoading(true)
    setNotFound(false)
    refresh()
  }, [router.isReady, refresh])

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdminSession()
      setIsAdmin(ok)
    })()
  }, [])

  // Make body/html transparent so OBS/etc. can overlay this page on a stream.
  useEffect(() => {
    if (streamMode) makeBackgroundInvisible()
  }, [streamMode])

  // Called by setup/bracket views after a successful save. If the slug
  // changed (rename), navigate to the new URL instead of refetching the old
  // one (which would 404).
  const handleSaved = useCallback(
    async (updated?: Tournament | null) => {
      if (updated && slug && updated.slug !== slug) {
        await router.replace(`/tournaments/${encodeURIComponent(updated.slug)}`)
        return
      }
      await refresh()
    },
    [router, slug, refresh]
  )

  // Throws away the built bracket but keeps name/bracketType/teamCount/teams,
  // so the admin returns to the setup screen with the same seeded team list.
  // When scores have already been recorded the admin is asked to confirm a
  // second time before the data is destroyed.
  const handleRestart = useCallback(async () => {
    if (!tournament || !slug) return
    if (
      !confirm(
        'Restart this tournament? The built bracket will be cleared. Settings and team names are kept.'
      )
    ) {
      return
    }
    if (
      tournament.isStarted &&
      !confirm(
        'Scores have already been recorded for this tournament. Restarting will permanently delete ALL match results. Are you sure?'
      )
    ) {
      return
    }
    setRestarting(true)
    try {
      const updated = await updateTournament(slug, { data: null })
      setEditingSettings(false)
      await handleSaved(updated)
    } catch (e) {
      alert(`Failed to restart: ${e instanceof Error ? e.message : e}`)
    } finally {
      setRestarting(false)
    }
  }, [tournament, slug, handleSaved])

  const streamBracketStyles = useMemo(
    () => parseStreamBracketStyles(router.query, defaultBracketStyles),
    [router.query]
  )
  const streamStageFilter = useMemo(
    () => parseStreamStageFilter(router.query),
    [router.query]
  )

  const showSetup = useMemo(
    () => isAdmin && (editingSettings || !tournament?.data),
    [isAdmin, editingSettings, tournament?.data]
  )

  const bracketVisible = useMemo(() => {
    if (!tournament?.data) return false
    if (streamMode) return true
    return !showSetup
  }, [tournament?.data, streamMode, showSetup])

  const BRACKET_POLL_MS = 2000

  useEffect(() => {
    if (!router.isReady || !slug || loading || !bracketVisible) return

    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const u = await getTournamentUpdatedAt(slug)
        if (u === null) return
        if (u !== lastServerUpdatedAtRef.current) {
          await refresh()
        }
      } catch {
        // ignore transient network errors
      }
    }

    const id = window.setInterval(() => {
      void tick()
    }, BRACKET_POLL_MS)
    return () => clearInterval(id)
  }, [router.isReady, slug, loading, bracketVisible, refresh])

  if (loading) {
    if (streamMode) return null
    return (
      <PageWrapper>
        <div className="mt-8 text-center">Loading…</div>
      </PageWrapper>
    )
  }

  if (notFound || !tournament) {
    if (streamMode) return null
    return (
      <PageWrapper>
        <Head>
          <title>Tournament not found - Aalto Gamers</title>
        </Head>
        <div className="mt-8 text-center">Tournament not found.</div>
      </PageWrapper>
    )
  }

  // Stream mode: chrome-free, no margins, transparent background. Editing is
  // disabled regardless of admin status so scores can't be changed by clicking
  // through the overlay.
  if (streamMode) {
    if (!tournament.data) return null
    return (
      <>
        <Head>
          <title>{tournament.name} - Aalto Gamers</title>
        </Head>
        <TournamentBracketView
          tournament={tournament}
          isAdmin={false}
          bracketStyles={streamBracketStyles}
          visibleStages={streamStageFilter.stageIndices}
          visibleGroups={streamStageFilter.groups}
        />
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{tournament.name} - Aalto Gamers</title>
      </Head>
      <PageWrapper>
        {isAdmin && (
          <div className="mt-8">
            <Link
              href="/tournaments"
              className="inline-block text-sm text-white border-lightgray border-[1px] py-1 px-3 hover:border-red"
            >
              ← Back to tournaments
            </Link>
          </div>
        )}
        <div className="mt-2 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl">{tournament.name}</h1>
            <p className="text-sm opacity-75">
              {getBracketTypeLabel(tournament.bracketType)} — {tournament.teamCount} teams
              {isAdmin && (tournament.isStarted ? ' — started (settings locked)' : ' — not started')}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              {!tournament.isStarted && tournament.data && (
                <button
                  type="button"
                  className="borderbutton"
                  onClick={() => setEditingSettings((v) => !v)}
                >
                  {editingSettings ? 'Back to bracket' : 'Edit settings'}
                </button>
              )}
              {tournament.data && (
                <button
                  type="button"
                  className="borderbutton"
                  onClick={handleRestart}
                  disabled={restarting}
                  title={
                    tournament.isStarted
                      ? 'Clear the built bracket and ALL recorded match results. Settings and team names are kept.'
                      : 'Clear the built bracket and return to setup (team names are kept).'
                  }
                >
                  {restarting ? 'Restarting…' : 'Restart tournament'}
                </button>
              )}
              <Link
                href={`/tournaments/${encodeURIComponent(tournament.slug)}/stream-customization`}
                className="borderbutton"
              >
                Stream customization
              </Link>
            </div>
          )}
        </div>

        {showSetup ? (
          <TournamentSetup tournament={tournament} onChanged={handleSaved} />
        ) : tournament.data ? (
          <TournamentBracketView
            tournament={tournament}
            isAdmin={isAdmin}
            onSaved={() => {
              // Re-read so `isStarted` updates after scores are added.
              refresh()
            }}
          />
        ) : (
          <div className="text-center mt-8 opacity-75">
            This tournament has not been built yet. Come back soon!
          </div>
        )}
      </PageWrapper>
    </>
  )
}

export default TournamentPage
