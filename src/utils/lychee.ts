import { LycheeAlbum } from '../types/types'
import { LYCHEE_BASE_URL } from './constants'

export const fetchLycheeAlbums = async (): Promise<LycheeAlbum[]> => {
  const initResponse = await fetch(`${LYCHEE_BASE_URL}/`, { signal: AbortSignal.timeout(5000) })
  const initCookies = parseSetCookieHeaders(initResponse)
  const xsrfToken = decodeURIComponent(initCookies['XSRF-TOKEN'])

  const albumsResponse = await fetch(`${LYCHEE_BASE_URL}/api/v2/Albums`, {
    signal: AbortSignal.timeout(5000),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': xsrfToken,
      Cookie: formatCookies(initCookies),
    },
  })

  if (!albumsResponse.ok) {
    throw new Error(`Lychee albums request failed: ${albumsResponse.status}`)
  }

  const data = (await albumsResponse.json()) as { albums: LycheeAlbum[] }

  return data.albums || []
}

const CACHE_MS = 10 * 60_000
let cached: { albums: LycheeAlbum[]; fetchedAt: number } | null = null
let fetching: Promise<LycheeAlbum[]> | null = null

// Cached for 10 min, since the event pages ask for them on every request. If
// fetching fails, the last albums are used.
export const getLycheeAlbums = async (): Promise<LycheeAlbum[]> => {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.albums
  fetching ??= fetchLycheeAlbums()
    .then((albums) => {
      cached = { albums, fetchedAt: Date.now() }
      return albums
    })
    .catch(() => {
      console.warn('Failed to fetch Lychee albums, skipping album linking')
      // Try again in a minute
      cached = { albums: cached?.albums ?? [], fetchedAt: Date.now() - CACHE_MS + 60_000 }
      return cached.albums
    })
    .finally(() => {
      fetching = null
    })
  return fetching
}

const parseSetCookieHeaders = (response: Response) => {
  const cookies: { [key: string]: string } = {}
  for (const cookie of response.headers.getSetCookie()) {
    const match = cookie.match(/^([^=]+)=([^;]+)/)
    if (match) cookies[match[1]] = match[2]
  }
  return cookies
}

const formatCookies = (cookies: { [s: string]: unknown }) => {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}
