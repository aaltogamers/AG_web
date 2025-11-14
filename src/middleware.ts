import { NextRequest, NextResponse } from 'next/server'

let authData: {
  kind: string
  localId: string
  email: string
  displayName: string
  idToken: string
  registered: boolean
  refreshToken: string
  expiresIn: string
} | null = null
let lastAuthTime = 0

export default async function middleware(req: NextRequest) {
  const url = req.url || ''
  const urlObj = new URL(url)
  let path = urlObj.pathname
  urlObj.searchParams.forEach((value, key) => {
    path += `?${key}=${value}`
  })

  if (req.headers.get('purpose') === 'prefetch' || req.headers.get('next-url')) {
    return NextResponse.next()
  }

  //const isDev = urlObj.host.includes('localhost')
  const timeNow = Date.now()
  const secondsSinceLastAuth = (timeNow - lastAuthTime) / 1000

  if (!authData?.idToken || secondsSinceLastAuth >= (Number(authData?.expiresIn) || 0)) {
    try {
      const apiKey = 'AIzaSyAWhfwD5GSsgZ8qzNyvn2kmNn3yVu0QaHY'
      const authRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          body: JSON.stringify({
            email: 'guest@aaltogamers.fi',
            password: 'aaltogamerpassword',
            returnSecureToken: true,
          }),
          method: 'POST',
        }
      )
      authData = await authRes.json()
      lastAuthTime = timeNow
    } catch (e) {
      console.error(e)
    }
  }

  // Stopped collecting statistics, because filled out entire Firestore quota.
  /*
  if (authData?.idToken) {
    const newId: string =
      new Date().getTime().toString() + Math.random().toString(36).substring(4).toString()
    try {
      await fetch(
        `https://firestore.googleapis.com/v1/projects/ag-web-ab4d9/databases/(default)/documents/analytics/${newId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${authData.idToken}`,
          },
          body: JSON.stringify({
            fields: {
              path: { stringValue: path },
              timestamp: { timestampValue: new Date().toISOString() },
              isDev: { booleanValue: isDev },
            },
          }),
        }
      )
    } catch (e) {
      console.error(e)
    }
  }
    */

  return NextResponse.next()
}

export const config = {
  // matcher solution for public, api, assets and _next exclusion
  matcher: '/((?!api|static|.*\\..*|_next).*)',
}
