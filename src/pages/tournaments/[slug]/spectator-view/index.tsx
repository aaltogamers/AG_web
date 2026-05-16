'use client'
import type { Database } from 'brackets-manager'
import { BracketsManager } from 'brackets-manager'
import type { Id } from 'brackets-model'
import { InMemoryDatabase } from 'brackets-memory-db'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import PageWrapper from '../../../../components/PageWrapper'
import type { BracketData, Tournament } from '../../../../types/types'
import {
  getBracketsData,
  getParticipantsById,
  teamNameToShortName,
} from '../../../../utils/brackets'
import makeBackgroundInvisible from '../../../../utils/makeBackgroundInvisible'
import { isStreamMode } from '../../../../utils/streamMode'
import { getTournament, getTournamentUpdatedAt } from '../../../../utils/tournamentApi'

/** Stable IDs for OBS / browser-source custom CSS (see info section on this page). */
const OVERLAY_TEAM1_ID = 'team1'
const OVERLAY_TEAM2_ID = 'team2'

const POLL_MS = 2000

function findStreamMatchNames(
  brackets: BracketData[],
  streamMatchId: number | null
): { full1: string; full2: string } {
  if (streamMatchId == null) return { full1: '', full2: '' }
  const id = streamMatchId as Id
  for (const bd of brackets) {
    const match = bd.matches.find((m) => m.id === id)
    if (!match) continue
    const participantsById = getParticipantsById(bd)
    const full1 =
      match.opponent1?.id != null ? (participantsById[match.opponent1.id]?.name ?? '') : ''
    const full2 =
      match.opponent2?.id != null ? (participantsById[match.opponent2.id]?.name ?? '') : ''
    return { full1, full2 }
  }
  return { full1: '', full2: '' }
}

const SpectatorViewNames = ({ team1, team2 }: { team1: string; team2: string }) => {
  return (
    <>
      <span
        id={OVERLAY_TEAM1_ID}
        className="absolute top-1 left-[25%] text-left font-beaufort text-5xl font-bold tracking-wide text-[#0783bd]"
      >
        {team1}
      </span>
      <span
        id={OVERLAY_TEAM2_ID}
        className="absolute top-1 right-[25%] text-right font-beaufort text-5xl font-bold tracking-wide text-[#b63f42]"
      >
        {team2}
      </span>
    </>
  )
}

const SpectatorViewPage = () => {
  const router = useRouter()
  const rawSlug = router.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug

  const streamMode = router.isReady && isStreamMode(router.query)

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [shortOpponent1, setShortOpponent1] = useState('')
  const [shortOpponent2, setShortOpponent2] = useState('')

  const [origin, setOrigin] = useState('')
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const lastServerUpdatedAtRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (streamMode) makeBackgroundInvisible()
  }, [streamMode])

  const refresh = useCallback(async () => {
    if (!slug) return
    const t = await getTournament(slug)
    if (!t) {
      setNotFound(true)
      setLoading(false)
      setTournament(null)
      return
    }
    lastServerUpdatedAtRef.current = t.updatedAt
    setTournament(t)
    setNotFound(false)
    setLoading(false)
  }, [slug])

  useEffect(() => {
    if (!router.isReady) return
    setLoading(true)
    setNotFound(false)
    void refresh()
  }, [router.isReady, refresh])

  useEffect(() => {
    if (!router.isReady || !slug || loading || !tournament?.data) return

    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const u = await getTournamentUpdatedAt(slug)
        if (u === null) return
        if (u !== lastServerUpdatedAtRef.current) await refresh()
      } catch {
        // ignore
      }
    }

    const id = window.setInterval(() => {
      void tick()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [router.isReady, slug, loading, tournament?.data, refresh])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!tournament?.data) {
        setShortOpponent1('')
        setShortOpponent2('')
        return
      }

      const storage = new InMemoryDatabase()
      const manager = new BracketsManager(storage)

      try {
        await manager.import(tournament.data as unknown as Database)
        const stages = (tournament.data.stage ?? []) as { id: number }[]
        if (stages.length < 2) throw new Error('Bracket data is incomplete (missing stages).')

        const bracketBundle = await getBracketsData(
          manager,
          stages[0].id,
          stages[1].id,
          tournament.teamCount,
          tournament.streamMatchId ?? null
        )
        if (cancelled) return

        const { full1, full2 } = findStreamMatchNames(
          bracketBundle,
          tournament.streamMatchId ?? null
        )
        setShortOpponent1(full1 ? teamNameToShortName(full1) : '')
        setShortOpponent2(full2 ? teamNameToShortName(full2) : '')
      } catch (err) {
        if (cancelled) return
        console.error('[SpectatorView] hydrate failed:', err)
        setShortOpponent1('')
        setShortOpponent2('')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [tournament?.data, tournament?.teamCount, tournament?.streamMatchId, tournament?.updatedAt])

  const streamUrl = useMemo(() => {
    if (!slug || !origin) return ''
    return `${origin}/tournaments/${encodeURIComponent(slug)}/spectator-view?stream`
  }, [slug, origin])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage('Copied!')
      setTimeout(() => setCopyMessage(null), 1500)
    } catch {
      setCopyMessage('Failed to copy')
      setTimeout(() => setCopyMessage(null), 1500)
    }
  }

  if (!router.isReady || loading) {
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

  if (streamMode) {
    if (!tournament.data) return null

    return (
      <>
        <Head>
          <title>{tournament.name} — Spectator - Aalto Gamers</title>
        </Head>
        <div className="fixed inset-0 bg-transparent pointer-events-none overflow-hidden">
          <SpectatorViewNames team1={shortOpponent1} team2={shortOpponent2} />
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Spectator view — {tournament.name} - Aalto Gamers</title>
      </Head>
      <PageWrapper>
        <div className="mt-8 mb-12">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <h2 className="text-4xl">
              Spectator overlay{tournament ? ` — ${tournament.name}` : ''}
            </h2>
            {slug && (
              <Link href={`/tournaments/${encodeURIComponent(slug)}`} className="borderbutton">
                Back to bracket
              </Link>
            )}
          </div>

          <p className="mb-4 text-sm opacity-90">
            Stream spectator overlay shows only two shortened team labels for the match marked as
            the <strong className="font-medium">stream game</strong> on the bracket. Add{' '}
            <span className="font-mono">?stream</span> to the current url to view it.
          </p>

          <div className="mb-6 p-4 rounded-md border border-lightgray border-opacity-40">
            <h3 className="text-2xl mb-2">Custom CSS</h3>
            <p className="text-sm opacity-90 mb-3">
              To style the overlay, use custom CSS. Use these IDs to target the team labels:
            </p>
            <ul className="font-mono text-sm space-y-1 opacity-95">
              <li>
                <code>#{OVERLAY_TEAM1_ID}</code> — left side / top team in bracket
              </li>
              <li>
                <code>#{OVERLAY_TEAM2_ID}</code> — right side / bottom team in bracket
              </li>
            </ul>
          </div>

          <div className="mb-6">
            <div className="text-sm mb-1">Overlay URL</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-sm break-all flex-1 min-w-0 opacity-90">
                {streamUrl || '…'}
              </code>
              <button
                type="button"
                className="borderbutton"
                disabled={!streamUrl}
                onClick={() => streamUrl && void copyToClipboard(streamUrl)}
              >
                Copy URL
              </button>
              {streamUrl && (
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="borderbutton"
                >
                  Open
                </a>
              )}
            </div>
            {copyMessage && <p className="text-sm mt-2 opacity-90">{copyMessage}</p>}
          </div>

          <div className="mb-6 p-4 rounded-md border border-lightgray border-opacity-40  h-36">
            <h3 className="text-2xl mb-2">Preview</h3>
            <div className="relative">
              <SpectatorViewNames team1={shortOpponent1} team2={shortOpponent2} />
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}

export default SpectatorViewPage
