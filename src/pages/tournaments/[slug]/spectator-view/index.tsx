'use client'
import type { Database } from 'brackets-manager'
import { BracketsManager } from 'brackets-manager'
import { Match, Status, type Id } from 'brackets-model'
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
import { isStreamMode, shouldFlipTeams } from '../../../../utils/streamMode'
import { getTournament, getTournamentUpdatedAt } from '../../../../utils/tournamentApi'

/** Stable IDs for OBS / browser-source custom CSS (see info section on this page). */
const OVERLAY_TEAM1_ID = 'team1'
const OVERLAY_TEAM2_ID = 'team2'
const OVERLAY_TEAM_CONTAINER_ID = 'team-container'

const POLL_MS = 2000

function findStreamMatch(
  brackets: BracketData[],
  streamMatchId: number | null
): { name1: string; name2: string; match: Match | null } {
  if (streamMatchId == null) return { name1: '', name2: '', match: null }
  const id = streamMatchId as Id
  for (const bd of brackets) {
    const match = bd.matches.find((m) => m.id === id)
    if (!match) continue
    const participantsById = getParticipantsById(bd)
    const name1 =
      match.opponent1?.id != null ? (participantsById[match.opponent1.id]?.name ?? '') : ''
    const name2 =
      match.opponent2?.id != null ? (participantsById[match.opponent2.id]?.name ?? '') : ''

    return { name1, name2, match }
  }
  return { name1: '', name2: '', match: null }
}

const SpectatorViewScore = ({
  score,
  color,
  team,
}: {
  score: number // 0, 1, or 2
  color: string
  team: string
}) => {
  return (
    <div className="flex flex-col gap-2 justify-center items-center mx-2" id={`${team}-score`}>
      {[2, 1].map((s) => (
        <div
          className="w-8 h-3 border-[#c89c38] border-solid border-1"
          id={`${team}-score-${s}`}
          key={s}
          style={{ backgroundColor: score >= s ? color : 'transparent' }}
        />
      ))}
    </div>
  )
}

const SpectatorViewNames = ({
  team1,
  team2,
  showScores,
  opponent1Score,
  opponent2Score,
}: {
  team1: string
  team2: string
  showScores: boolean
  opponent1Score: number
  opponent2Score: number
}) => {
  return (
    <div
      className="absolute top-1 font-bold font-beaufort text-5xl w-full flex justify-center text-center gap-[61%]"
      id={OVERLAY_TEAM_CONTAINER_ID}
    >
      <span id={OVERLAY_TEAM1_ID} className="text-[#0783bd] w-60 text-right flex justify-end">
        {showScores && <SpectatorViewScore score={opponent1Score} color="#0783bd" team="team1" />}
        {team1}
      </span>

      <span id={OVERLAY_TEAM2_ID} className="pl-3 text-[#b63f42] w-60 text-left flex justify-start">
        {team2}
        {showScores && <SpectatorViewScore score={opponent2Score} color="#b63f42" team="team2" />}
      </span>
    </div>
  )
}

const SpectatorViewPage = () => {
  const router = useRouter()
  const rawSlug = router.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug

  const streamMode = router.isReady && isStreamMode(router.query)
  const flipTeams = router.isReady && shouldFlipTeams(router.query)

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [shortOpponent1, setShortOpponent1] = useState('')
  const [shortOpponent2, setShortOpponent2] = useState('')
  const [streamMatch, setStreamMatch] = useState<Match | null>(null)

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
      setLoading(false)
      setTournament(null)
      return
    }
    lastServerUpdatedAtRef.current = t.updatedAt
    setTournament(t)
    setLoading(false)
  }, [slug])

  useEffect(() => {
    if (!router.isReady) return
    setLoading(true)
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

        const { name1, name2, match } = findStreamMatch(
          bracketBundle,
          tournament.streamMatchId ?? null
        )
        setShortOpponent1(name1 ? teamNameToShortName(name1) : '')
        setShortOpponent2(name2 ? teamNameToShortName(name2) : '')
        setStreamMatch(match)
      } catch (err) {
        if (cancelled) return
        console.error('[SpectatorView] hydrate failed:', err)
        setShortOpponent1('')
        setShortOpponent2('')
        setStreamMatch(null)
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

  if (!tournament) {
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

  const opponent1Score = streamMatch?.opponent1?.score ?? 0
  const opponent2Score = streamMatch?.opponent2?.score ?? 0

  const isOngoing =
    (streamMatch?.opponent1?.score != undefined || streamMatch?.opponent2?.score != undefined) &&
    streamMatch?.status === Status.Running

  if (streamMode) {
    if (!tournament.data) return null

    return (
      <>
        <Head>
          <title>{tournament.name} — Spectator - Aalto Gamers</title>
        </Head>
        <div className="fixed inset-0 bg-transparent pointer-events-none overflow-hidden">
          <SpectatorViewNames
            team1={flipTeams ? shortOpponent2 : shortOpponent1}
            team2={flipTeams ? shortOpponent1 : shortOpponent2}
            showScores={isOngoing}
            opponent1Score={flipTeams ? opponent2Score : opponent1Score}
            opponent2Score={flipTeams ? opponent1Score : opponent2Score}
          />
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
            <span className="font-mono">?stream</span> to the current url to view it. You can also
            add <span className="font-mono">?flip</span> to flip which team is shown on which side
            of the overlay.
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
              <SpectatorViewNames
                team1={shortOpponent1}
                team2={shortOpponent2}
                showScores={isOngoing}
                opponent1Score={opponent1Score}
                opponent2Score={opponent2Score}
              />
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}

export default SpectatorViewPage
