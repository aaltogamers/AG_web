// Instagram feed posts. Tokens last 60 days; renewed ones are stored in
// social_settings.
import crypto from 'crypto'
import { getInstagramTokenState, saveInstagramTokenState } from '../postStore'

const GRAPH = 'https://graph.instagram.com/v23.0'

export class InstagramError extends Error {}

export const isInstagramConfigured = () =>
  !!process.env.INSTAGRAM_USER_ID && !!process.env.INSTAGRAM_ACCESS_TOKEN

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

// The renewed token, unless INSTAGRAM_ACCESS_TOKEN has been changed since, e.g.
// after the old one expired
const getToken = async () => {
  const state = await getInstagramTokenState()
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const renewedFromEnv = !envToken || state.envTokenHash === hashToken(envToken)
  const token = (renewedFromEnv && state.accessToken) || envToken
  if (!token) throw new InstagramError('INSTAGRAM_ACCESS_TOKEN is not set')
  return token
}

const userId = () => {
  const id = process.env.INSTAGRAM_USER_ID
  if (!id) throw new InstagramError('INSTAGRAM_USER_ID is not set')
  return id
}

const call = async <T>(
  path: string,
  params: Record<string, string>,
  method: 'GET' | 'POST' = 'GET'
): Promise<T> => {
  const query = new URLSearchParams({ ...params, access_token: await getToken() })
  const res = await fetch(
    method === 'GET' ? `${GRAPH}${path}?${query}` : `${GRAPH}${path}`,
    method === 'GET' ? {} : { method, body: query }
  )
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok || body.error) {
    throw new InstagramError(`Instagram: ${body.error?.message ?? `HTTP ${res.status}`}`)
  }
  return body
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Instagram downloads the image in the background; publishing has to wait for it
const waitUntilReady = async (containerId: string) => {
  for (let i = 0; i < 30; i++) {
    const { status_code: status } = await call<{ status_code: string }>(`/${containerId}`, {
      fields: 'status_code',
    })
    if (status === 'FINISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new InstagramError(`Instagram couldn't process the image (${status})`)
    }
    await sleep(2000)
  }
  throw new InstagramError('Instagram took too long to process the image')
}

// Publishes a feed post from public JPEG URLs and returns the media id
export const publishInstagramPost = async (imageUrls: string[], caption: string): Promise<string> => {
  if (!imageUrls.length) throw new InstagramError('Instagram posts need at least one image')
  const id = userId()
  let containerId: string
  if (imageUrls.length === 1) {
    containerId = (await call<{ id: string }>(`/${id}/media`, { image_url: imageUrls[0], caption }, 'POST')).id
  } else {
    const children: string[] = []
    for (const url of imageUrls) {
      const child = await call<{ id: string }>(
        `/${id}/media`,
        { image_url: url, is_carousel_item: 'true' },
        'POST'
      )
      children.push(child.id)
    }
    await Promise.all(children.map(waitUntilReady))
    containerId = (
      await call<{ id: string }>(
        `/${id}/media`,
        { media_type: 'CAROUSEL', children: children.join(','), caption },
        'POST'
      )
    ).id
  }
  await waitUntilReady(containerId)
  const published = await call<{ id: string }>(`/${id}/media_publish`, { creation_id: containerId }, 'POST')
  return published.id
}

export const getInstagramAccount = async () => {
  const [account, state] = await Promise.all([
    call<{ username: string; account_type?: string; user_id?: string }>('/me', {
      fields: 'username,account_type,user_id',
    }),
    getInstagramTokenState(),
  ])
  return {
    username: account.username,
    accountType: account.account_type ?? null,
    tokenExpiresAt: state.expiresAt ?? null,
    tokenRefreshedAt: state.refreshedAt ?? null,
    lastError: state.lastError ?? null,
  }
}

// Renews the long-lived token. Tokens can only be renewed when at least a day old.
export const refreshInstagramToken = async () => {
  const query = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: await getToken(),
  })
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${query}`)
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: { message?: string }
  }
  if (!res.ok || !body.access_token) {
    throw new InstagramError(`Instagram token renewal failed: ${body.error?.message ?? `HTTP ${res.status}`}`)
  }
  const expiresAt = new Date(Date.now() + (body.expires_in ?? 60 * 86400) * 1000).toISOString()
  await saveInstagramTokenState({
    accessToken: body.access_token,
    envTokenHash: process.env.INSTAGRAM_ACCESS_TOKEN
      ? hashToken(process.env.INSTAGRAM_ACCESS_TOKEN)
      : undefined,
    expiresAt,
    refreshedAt: new Date().toISOString(),
    lastError: undefined,
  })
  return expiresAt
}
