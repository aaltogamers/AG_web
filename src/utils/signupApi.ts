import type { DataValue, SignupInput, SignupRow, SignUpData } from '../types/types'

export type AnswerMap = Record<string, DataValue>

export type SignupEvent = {
  key: string
  maxparticipants: number
  openfrom: string
  openuntil: string
  inputs: SignupInput[]
}

const tokenKey = (signupKey: string) => `signupToken-${signupKey}`
const idKey = (signupKey: string) => `signupId-${signupKey}`

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
): Promise<{ signups: SignupRow[]; ownSignupId: string | null }> => {
  const headers: Record<string, string> = {}
  if (submissionToken) headers['x-submission-token'] = submissionToken
  const res = await fetch(`/api/signups?key=${encodeURIComponent(signupKey)}`, {
    credentials: 'same-origin',
    headers,
  })
  if (!res.ok) return { signups: [], ownSignupId: null }
  return (await res.json()) as { signups: SignupRow[]; ownSignupId: string | null }
}

export const createSignup = async (
  signupKey: string,
  answers: AnswerMap
): Promise<{ id: string; submission_token: string; created_at: string }> => {
  const res = await fetch('/api/signups', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ key: signupKey, answers }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return (await res.json()) as { id: string; submission_token: string; created_at: string }
}

export const updateSignup = async (
  id: string,
  answers: AnswerMap,
  submissionToken: string
): Promise<void> => {
  const res = await fetch(`/api/signups/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-submission-token': submissionToken,
    },
    credentials: 'same-origin',
    body: JSON.stringify({ answers }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
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
