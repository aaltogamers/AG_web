import type { SignupInput, SignupPool, SignupRow, SignUpData } from '../types/types'
import type { AnswerMap } from './signupAnswers'

export type { AnswerMap }
// New images by field id, as data URLs
export type FileMap = Record<string, string>

export type SignupEvent = {
  key: string
  pools: SignupPool[]
  openfrom: string
  openuntil: string
  inputs: SignupInput[]
  // Only sent to admins, see SignUpData
  confirmedMessage?: string
  confirmedLink?: string
}

// A sign-up form with the number of sign-ups in each pool, keyed by pool id
export type SignupSummary = SignupEvent & { counts: Record<number, number> }

const tokenKey = (signupKey: string) => `signupToken-${signupKey}`
const idKey = (signupKey: string) => `signupId-${signupKey}`

// A link that lets the participant edit their sign-up on another device
export const signupEditLink = (eventSlug: string, signupKey: string) => {
  const stored = getStoredSignup(signupKey)
  if (!stored || typeof window === 'undefined') return null
  const params = new URLSearchParams({ signup: signupKey, id: stored.id, token: stored.token })
  return `${window.location.origin}/events/${eventSlug}?${params}`
}

export const getStoredSignup = (signupKey: string): { id: string; token: string } | null => {
  if (typeof window === 'undefined') return null
  const id = localStorage.getItem(idKey(signupKey))
  const token = localStorage.getItem(tokenKey(signupKey))
  if (!id || !token) return null
  return { id, token }
}

export const setStoredSignup = (signupKey: string, id: string, token: string): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(idKey(signupKey), id)
  localStorage.setItem(tokenKey(signupKey), token)
}

export const clearStoredSignup = (signupKey: string): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(idKey(signupKey))
  localStorage.removeItem(tokenKey(signupKey))
}

// Unsent answers are kept in the browser, e.g. if the dialog or page is closed by accident.
// signupId is the sign-up being edited (null for a new one), so a draft is never
// restored onto a different sign-up.
export type SignupDraft = { answers: AnswerMap; poolId: number; signupId: string | null }

const draftKey = (signupKey: string) => `signup-draft:${signupKey}`

export const readSignupDraft = (signupKey: string): SignupDraft | null => {
  try {
    const stored = localStorage.getItem(draftKey(signupKey))
    return stored ? (JSON.parse(stored) as SignupDraft) : null
  } catch {
    return null
  }
}

export const storeSignupDraft = (signupKey: string, draft: SignupDraft | null): void => {
  try {
    if (!draft) {
      localStorage.removeItem(draftKey(signupKey))
      return
    }
    try {
      localStorage.setItem(draftKey(signupKey), JSON.stringify(draft))
    } catch {
      // Too big for the storage; keep the answers without the new images
      const withoutImages = JSON.stringify(draft, (_, value) =>
        typeof value === 'string' && value.startsWith('data:') ? undefined : value
      )
      localStorage.setItem(draftKey(signupKey), withoutImages)
    }
  } catch {
    // E.g. a private window; the answers just aren't kept
  }
}

export const listSignupEvents = async (): Promise<SignupEvent[]> => {
  const res = await fetch('/api/signup-events', { credentials: 'same-origin' })
  if (!res.ok) return []
  const data = (await res.json()) as { events: SignupEvent[] }
  return data.events
}

export const getSignupEvent = async (signupKey: string): Promise<SignupEvent | null> => {
  const res = await fetch(`/api/signup-events/${encodeURIComponent(signupKey)}`, {
    credentials: 'same-origin',
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  const data = (await res.json()) as { event: SignupEvent }
  return data.event
}

export const getSignupSummaries = async (signupKeys: string[]): Promise<SignupSummary[]> => {
  if (!signupKeys.length) return []
  const keys = signupKeys.map(encodeURIComponent).join(',')
  const res = await fetch(`/api/signup-summaries?keys=${keys}`, { credentials: 'same-origin' })
  if (!res.ok) return []
  const data = (await res.json()) as { summaries: SignupSummary[] }
  return data.summaries
}

export const saveSignupEvent = async (event: SignUpData): Promise<SignupEvent> => {
  const res = await fetch('/api/signup-events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(event),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const data = (await res.json()) as { event: SignupEvent }
  return data.event
}

export const listSignups = async (
  signupKey: string,
  submissionToken?: string
): Promise<{
  signups: SignupRow[]
  ownSignupId: string | null
  confirmedMessage?: string
  confirmedLink?: string
}> => {
  const headers: Record<string, string> = {}
  if (submissionToken) headers['x-submission-token'] = submissionToken
  const res = await fetch(`/api/signups?key=${encodeURIComponent(signupKey)}`, {
    credentials: 'same-origin',
    headers,
  })
  if (!res.ok) return { signups: [], ownSignupId: null }
  return (await res.json()) as {
    signups: SignupRow[]
    ownSignupId: string | null
    confirmedMessage?: string
    confirmedLink?: string
  }
}

// Next.js answers a too large body with a plain-text 413
const saveError = async (res: Response) => {
  if (res.status === 413) return new Error('The image is too large. Try a smaller one.')
  const err = (await res.json().catch(() => ({}))) as { error?: string }
  return new Error(err.error || `HTTP ${res.status}`)
}

export const createSignup = async (
  signupKey: string,
  answers: AnswerMap,
  files: FileMap,
  poolId: number,
  poolPassword?: string
): Promise<{ id: string; submission_token: string; created_at: string }> => {
  const res = await fetch('/api/signups', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ key: signupKey, answers, files, poolId, poolPassword }),
  })
  if (!res.ok) throw await saveError(res)
  return (await res.json()) as { id: string; submission_token: string; created_at: string }
}

export const updateSignup = async (
  id: string,
  answers: AnswerMap,
  files: FileMap,
  poolId: number,
  submissionToken: string,
  poolPassword?: string
): Promise<void> => {
  const res = await fetch(`/api/signups/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-submission-token': submissionToken,
    },
    credentials: 'same-origin',
    body: JSON.stringify({ answers, files, poolId, poolPassword }),
  })
  if (!res.ok) throw await saveError(res)
}

export const deleteSignup = async (id: string, submissionToken?: string): Promise<void> => {
  const headers: Record<string, string> = {}
  if (submissionToken) headers['x-submission-token'] = submissionToken
  const res = await fetch(`/api/signups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
}

// Deletes the sign-up form of an event together with all its sign-ups
export const deleteSignupEvent = async (signupKey: string): Promise<void> => {
  const res = await fetch(`/api/signup-events/${encodeURIComponent(signupKey)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
}
