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

const REFRESH_MS = 10 * 60_000

// In-memory albums for the event pages, refreshed every 10 min in the background
// (instrumentation.ts), so that pages never wait for Lychee. Kept on globalThis so
// that the pages and instrumentation.ts (separate bundles) share it.
type Cache = { albums: LycheeAlbum[] | null; fetching: Promise<void> | null }
const globalForLychee = globalThis as unknown as { __agLycheeAlbums?: Cache }
const cache = (globalForLychee.__agLycheeAlbums ??= { albums: null, fetching: null })

// If fetching fails, the last albums are kept
const refreshLycheeAlbums = (): Promise<void> =>
  (cache.fetching ??= fetchLycheeAlbums()
    .then((albums) => {
      cache.albums = albums
    })
    .catch((err) => console.warn('[lychee] fetching albums failed:', err))
    .finally(() => {
      cache.fetching = null
    }))

export const startLycheeAlbumRefresh = () => {
  refreshLycheeAlbums()
  setInterval(refreshLycheeAlbums, REFRESH_MS)
}

// The albums, or none (no album links) if they haven't been fetched yet
export const getLycheeAlbums = (): LycheeAlbum[] => {
  if (!cache.albums) refreshLycheeAlbums()
  return cache.albums ?? []
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
