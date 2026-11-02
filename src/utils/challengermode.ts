import { createHash } from 'crypto'
import type {
  ChallengermodeBracket,
  ChallengermodeBracketKind,
  ChallengermodeSeries,
  ChallengermodeSlot,
  ChallengermodeStage,
  ChallengermodeTournament,
} from '../types/types'
import { splitChallengermodeMatchId } from './challengermodeStages'

const API_URL = 'https://publicapi.challengermode.com'
// Cloudflare rejects some default user agents
const USER_AGENT = 'AaltoGamersWeb/1.0 (+https://aaltogamers.fi)'
const CACHE_TTL_MS = 10_000
const COMPLETED_CACHE_TTL_MS = 5 * 60_000
const ERROR_RETRY_MS = 30_000
const REQUEST_LIMIT_PER_MINUTE = 15

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export const parseChallengermodeId = (input: string): string | null =>
  input.match(UUID_RE)?.[0].toLowerCase() ?? null

const TOURNAMENT_QUERY = `
query ($id: UUID!) {
  tournament(tournamentId: $id) {
    id name state
    stages {
      index format lineupCount
      ... on TournamentEliminationStage { brackets { labels rounds { title matchSeries { ...MS } } } }
      ... on TournamentSwissStage { roundCount rounds { title matchSeries { ...MS } } }
    }
  }
}
fragment MS on MatchSeries {
  ordinal state bestOf labels
  lineups { id name seed }
  results { final draw lineupResults { lineupNumber score placement } }
}`

type RawLineup = { id: string; name: string; seed: number | null } | null

type RawSeries = {
  ordinal: number
  state: ChallengermodeSeries['state']
  bestOf: number
  labels: string[]
  lineups: RawLineup[]
  results: {
    final: boolean
    draw: boolean
    lineupResults: { lineupNumber: number; score: number | null; placement: number | null }[]
  }
}

type RawRound = { title: string; matchSeries: RawSeries[] }

type RawStage = {
  index: number
  format: ChallengermodeStage['format']
  lineupCount: number
  roundCount?: number
  rounds?: RawRound[]
  brackets?: { labels: string[]; rounds: RawRound[] }[]
}

type RawTournament = { id: string; name: string | null; state: string; stages: RawStage[] }

type CmState = {
  accessKey: { value: string; expiresAt: number } | null
  requestTimes: number[]
  cache: Map<string, ChallengermodeResult & { expiresAt: number }>
  inFlight: Map<string, Promise<void>>
}

const globalForCm = globalThis as unknown as { __agChallengermode?: CmState }

const state: CmState = (globalForCm.__agChallengermode ??= {
  accessKey: null,
  requestTimes: [],
  cache: new Map(),
  inFlight: new Map(),
})

const freeRequestSlots = () => {
  const now = Date.now()
  state.requestTimes = state.requestTimes.filter((t) => now - t < 60_000)
  return REQUEST_LIMIT_PER_MINUTE - state.requestTimes.length
}

const hasValidAccessKey = () => !!state.accessKey && state.accessKey.expiresAt > Date.now() + 60_000

const takeRequestSlot = () => {
  const now = Date.now()
  if (freeRequestSlots() <= 0) {
    throw new Error('Challengermode request limit reached, try again in a minute')
  }
  state.requestTimes.push(now)
}

const post = async (path: string, body: unknown, accessKey?: string): Promise<unknown> => {
  takeRequestSlot()
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
      ...(accessKey ? { authorization: `Bearer ${accessKey}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Challengermode responded with HTTP ${res.status}`)
  return res.json()
}

const getAccessKey = async (): Promise<string> => {
  if (state.accessKey && hasValidAccessKey()) {
    return state.accessKey.value
  }
  const refreshKey = process.env.CHALLENGERMODE_REFRESH_KEY
  if (!refreshKey) throw new Error('CHALLENGERMODE_REFRESH_KEY is not set')
  const res = (await post('/mk1/v1/auth/access_keys', { refreshKey })) as {
    value?: string
    expiresAt?: string
  }
  if (!res.value) throw new Error('Challengermode did not return an access key')
  const expiresAt = res.expiresAt ? Date.parse(res.expiresAt) : Date.now() + 30 * 60_000
  state.accessKey = { value: res.value, expiresAt }
  return res.value
}

// Read-only: this module must never send mutations to Challengermode
const query = async <T>(gql: string, variables: Record<string, unknown>): Promise<T> => {
  const accessKey = await getAccessKey()
  const res = (await post('/graphql', { query: gql, variables }, accessKey)) as {
    data?: T
    errors?: { message: string }[]
  }
  if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '))
  if (!res.data) throw new Error('Challengermode returned no data')
  return res.data
}

const toSlots = (series: RawSeries): ChallengermodeSeries['slots'] => {
  const lineups = series.lineups.filter((l): l is NonNullable<RawLineup> => l != null)
  const results = series.results.lineupResults
  const resultOf = (lineupNumber: number) => results.find((r) => r.lineupNumber === lineupNumber)

  const toSlot = (lineup: NonNullable<RawLineup>, lineupNumber: number): ChallengermodeSlot => {
    const r = resultOf(lineupNumber)
    // Nullified series (e.g. a team disqualified afterwards) have no meaningful winner
    const decided =
      series.state !== 'NULLIFIED' && (series.results.final || series.state === 'COMPLETED')
    const other = results.find((x) => x.lineupNumber !== lineupNumber)
    const won =
      r?.placement != null
        ? r.placement === 1
        : r?.score != null && other?.score != null && r.score !== other.score
          ? r.score > other.score
          : null
    const result =
      !decided || won == null ? null : series.results.draw ? 'draw' : won ? 'win' : 'loss'
    return {
      lineupId: lineup.id,
      name: lineup.name,
      seed: lineup.seed,
      score: r?.score ?? null,
      result,
    }
  }

  if (lineups.length >= 2) return [toSlot(lineups[0], 0), toSlot(lineups[1], 1)]
  if (lineups.length === 0) return [null, null]
  // Byes and half-filled series only list the present team; its result tells its slot.
  const winner = results.find((r) => r.placement === 1)
  const slot = winner?.lineupNumber === 1 ? 1 : 0
  return slot === 0 ? [toSlot(lineups[0], 0), null] : [null, toSlot(lineups[0], 1)]
}

const BRACKET_KINDS: [string, ChallengermodeBracketKind][] = [
  ['DOUBLE_ELIMINATION_UPPER_BRACKET', 'upper'],
  ['DOUBLE_ELIMINATION_LOWER_BRACKET', 'lower'],
  ['DOUBLE_ELIMINATION_FINALS_BRACKET', 'final'],
]

const BRACKET_ORDER: ChallengermodeBracketKind[] = ['single', 'upper', 'lower', 'final', 'swiss']

const toRounds = (rounds: RawRound[]): ChallengermodeBracket['rounds'] =>
  rounds.map((round) => ({
    title: round.title,
    series: round.matchSeries.map((s) => ({
      ordinal: s.ordinal,
      state: s.state,
      bestOf: s.bestOf,
      labels: s.labels,
      slots: toSlots(s),
    })),
  }))

const toStage = (stage: RawStage): ChallengermodeStage => {
  const brackets: ChallengermodeBracket[] =
    stage.format === 'SWISS'
      ? [{ kind: 'swiss', rounds: toRounds(stage.rounds ?? []) }]
      : (stage.brackets ?? []).map((b) => ({
          kind: BRACKET_KINDS.find(([label]) => b.labels.includes(label))?.[1] ?? 'single',
          rounds: toRounds(b.rounds),
        }))
  brackets.sort((a, b) => BRACKET_ORDER.indexOf(a.kind) - BRACKET_ORDER.indexOf(b.kind))
  return {
    format: stage.format,
    lineupCount: stage.lineupCount,
    roundCount: stage.roundCount ?? brackets[0]?.rounds.length ?? 0,
    brackets,
  }
}

export const toChallengermodeTournament = (raw: RawTournament): ChallengermodeTournament => ({
  id: raw.id,
  name: raw.name ?? '',
  state: raw.state,
  stages: [...raw.stages].sort((a, b) => a.index - b.index).map(toStage),
})

const fetchTournament = async (id: string): Promise<ChallengermodeTournament> => {
  const { tournament } = await query<{ tournament: RawTournament | null }>(TOURNAMENT_QUERY, {
    id,
  })
  if (!tournament) throw new Error('Challengermode tournament not found')
  return toChallengermodeTournament(tournament)
}

export type ChallengermodeResult = {
  data: ChallengermodeTournament | null
  hash: string
  error?: string
}

const hashOf = (data: ChallengermodeTournament) =>
  createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 16)

const load = async (id: string, previous: ChallengermodeResult | undefined) => {
  try {
    const data = await fetchTournament(id)
    const ttl = data.state === 'COMPLETED' ? COMPLETED_CACHE_TTL_MS : CACHE_TTL_MS
    state.cache.set(id, { data, hash: hashOf(data), expiresAt: Date.now() + ttl })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[challengermode] fetching ${id} failed:`, error)
    state.cache.set(id, {
      data: previous?.data ?? null,
      hash: previous?.data ? previous.hash : 'error',
      error,
      expiresAt: Date.now() + ERROR_RETRY_MS,
    })
  }
}

// Cached, also on errors, so any number of viewers polling the site cause at most one Challengermode request per tournament per TTL
export const getChallengermodeTournament = async (id: string): Promise<ChallengermodeResult> => {
  const cached = state.cache.get(id)
  const neededSlots = hasValidAccessKey() ? 1 : 2
  // Over our own request budget, stale data is served as is and refreshed once a slot frees up
  const canRefresh = !cached?.data || freeRequestSlots() >= neededSlots
  if (canRefresh && (!cached || !(cached.expiresAt > Date.now()))) {
    let request = state.inFlight.get(id)
    if (!request) {
      request = load(id, cached).finally(() => state.inFlight.delete(id))
      state.inFlight.set(id, request)
    }
    await request
  }
  const { data, hash, error } = state.cache.get(id)!
  return error ? { data, hash, error } : { data, hash }
}

export const findChallengermodeSeries = (
  data: ChallengermodeTournament,
  matchId: number
): ChallengermodeSeries | null => {
  const { stageIndex, ordinal } = splitChallengermodeMatchId(matchId)
  for (const bracket of data.stages[stageIndex]?.brackets ?? []) {
    for (const round of bracket.rounds) {
      const series = round.series.find((s) => s.ordinal === ordinal)
      if (series) return series
    }
  }
  return null
}
