import type { StreamConfig } from '../types/types'

const handleError = async (res: Response, fallback: string): Promise<never> => {
  const err = (await res.json().catch(() => ({}))) as { error?: string }
  throw new Error(err.error || fallback)
}

const base = (slug: string) =>
  `/api/tournaments/${encodeURIComponent(slug)}/stream-configs`

export const listStreamConfigs = async (slug: string): Promise<StreamConfig[]> => {
  const res = await fetch(base(slug), { credentials: 'same-origin' })
  if (!res.ok) return []
  const data = (await res.json()) as { configs: StreamConfig[] }
  return data.configs
}

export const createStreamConfig = async (
  slug: string,
  payload: { name: string; query: string }
): Promise<StreamConfig> => {
  const res = await fetch(base(slug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  })
  if (!res.ok) await handleError(res, `HTTP ${res.status}`)
  const data = (await res.json()) as { config: StreamConfig }
  return data.config
}

export const updateStreamConfig = async (
  slug: string,
  id: string,
  payload: { name?: string; query?: string }
): Promise<StreamConfig> => {
  const res = await fetch(`${base(slug)}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  })
  if (!res.ok) await handleError(res, `HTTP ${res.status}`)
  const data = (await res.json()) as { config: StreamConfig }
  return data.config
}

export const deleteStreamConfig = async (slug: string, id: string): Promise<void> => {
  const res = await fetch(`${base(slug)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) await handleError(res, `HTTP ${res.status}`)
}
