'use client'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'

import PageWrapper from '../../components/PageWrapper'
import TournamentBracketView from '../../components/TournamentBracketView'
import TournamentSetup from '../../components/TournamentSetup'
import { Tournament, getBracketTypeLabel } from '../../types/types'
import { checkAdminSession } from '../../utils/adminAuth'
import { getTournament } from '../../utils/tournamentApi'

const TournamentPage = () => {
  const router = useRouter()
  const rawSlug = router.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingSettings, setEditingSettings] = useState(false)

  const refresh = useCallback(async () => {
    if (!slug) return
    const t = await getTournament(slug)
    if (!t) {
      setNotFound(true)
      setLoading(false)
      return
    }
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

  if (loading) {
    return (
      <PageWrapper>
        <div className="mt-8 text-center">Loading…</div>
      </PageWrapper>
    )
  }

  if (notFound || !tournament) {
    return (
      <PageWrapper>
        <Head>
          <title>Tournament not found - Aalto Gamers</title>
        </Head>
        <div className="mt-8 text-center">Tournament not found.</div>
      </PageWrapper>
    )
  }

  const showSetup = isAdmin && (editingSettings || !tournament.data)

  return (
    <>
      <Head>
        <title>{tournament.name} - Aalto Gamers</title>
      </Head>
      <PageWrapper>
        <div className="mt-8 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
