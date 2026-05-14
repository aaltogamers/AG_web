import type {
  BracketDatabaseSnapshot,
  BracketType,
  Tournament,
  TournamentSummary,
  TournamentTeamCount,
} from '../types/types'

export type CreateTournamentPayload = {
  name: string
  bracketType: BracketType
  teamCount: TournamentTeamCount
  teams?: string[]
}

export type UpdateTournamentSettingsPayload = {
  name?: string
  bracketType?: BracketType
  teamCount?: TournamentTeamCount
  teams?: string[]
  // Pass `null` to clear the built bracket (e.g. when changing settings before
  // start), or a full exported snapshot to overwrite.
  data?: BracketDatabaseSnapshot | null
}

const handleError = async (res: Response, fallback: string): Promise<never> => {
  const err = (await res.json().catch(() => ({}))) as { error?: string }
  throw new Error(err.error || fallback)
}

export const listTournaments = async (): Promise<TournamentSummary[]> => {
  const res = await fetch('/api/tournaments', { credentials: 'same-origin' })
  if (!res.ok) return []
  const data = (await res.json()) as { tournaments: TournamentSummary[] }
  return data.tournaments
}

export const getTournament = async (slug: string): Promise<Tournament | null> => {
  const res = await fetch(`/api/tournaments/${encodeURIComponent(slug)}`, {
    credentials: 'same-origin',
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  const data = (await res.json()) as { tournament: Tournament }
  return data.tournament
}

export const createTournament = async (
  payload: CreateTournamentPayload
): Promise<Tournament> => {
  const res = await fetch('/api/tournaments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  })
  if (!res.ok) await handleError(res, `HTTP ${res.status}`)
  const data = (await res.json()) as { tournament: Tournament }
  return data.tournament
}

export const updateTournament = async (
  slug: string,
  payload: UpdateTournamentSettingsPayload
): Promise<Tournament> => {
  const res = await fetch(`/api/tournaments/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  })
  if (!res.ok) await handleError(res, `HTTP ${res.status}`)
  const data = (await res.json()) as { tournament: Tournament }
  return data.tournament
}

export const saveTournamentData = async (
  slug: string,
  data: BracketDatabaseSnapshot
): Promise<Tournament> => updateTournament(slug, { data })

export const deleteTournament = async (slug: string): Promise<void> => {
  const res = await fetch(`/api/tournaments/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) await handleError(res, `HTTP ${res.status}`)
}
