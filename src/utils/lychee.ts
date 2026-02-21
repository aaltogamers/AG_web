import { LycheeAlbum } from '../types/types'
import { LYCHEE_BASE_URL } from './constants'

export const getLycheeAlbums = async () => {
  const initResponse = await fetch(`${LYCHEE_BASE_URL}/`)
  const initCookies = parseSetCookieHeaders(initResponse)
  const xsrfToken = decodeURIComponent(initCookies['XSRF-TOKEN'])

  const loginResponse = await fetch(`${LYCHEE_BASE_URL}/api/v2/Auth::login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': xsrfToken,
      Cookie: formatCookies(initCookies),
    },
  })

  const loginCookies = parseSetCookieHeaders(loginResponse)
  const allCookies = { ...initCookies, ...loginCookies }
  const newXsrfToken = loginCookies['XSRF-TOKEN']
    ? decodeURIComponent(loginCookies['XSRF-TOKEN'])
    : xsrfToken

  const albumsResponse = await fetch(`${LYCHEE_BASE_URL}/api/v2/Albums`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': newXsrfToken,
      Cookie: formatCookies(allCookies),
    },
  })

  const data = (await albumsResponse.json()) as { albums: LycheeAlbum[] }

  return data.albums || []
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
