import { LycheeAlbum } from '../types/types'
import { LYCHEE_BASE_URL } from './constants'

export const getLycheeAlbums = async (): Promise<LycheeAlbum[]> => {
  try {
    const initResponse = await fetch(`${LYCHEE_BASE_URL}/`)
    const initCookies = parseSetCookieHeaders(initResponse)
    const xsrfToken = decodeURIComponent(initCookies['XSRF-TOKEN'])

    const albumsResponse = await fetch(`${LYCHEE_BASE_URL}/api/v2/Albums`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': xsrfToken,
        Cookie: formatCookies(initCookies),
      },
    })

    const data = (await albumsResponse.json()) as { albums: LycheeAlbum[] }

    return data.albums || []
  } catch {
    console.warn('Failed to fetch Lychee albums, skipping album linking')
    return []
  }
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
