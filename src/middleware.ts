import { NextApiRequest } from 'next'
import { v4 as uuidv4 } from 'uuid'

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

export default async function middleware(req: NextApiRequest) {
  const url = req.url || ''
  const path = new URL(url).pathname
  const isDev = url.includes('localhost')
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

  if (authData?.idToken) {
    const newId = uuidv4()
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
}

export const config = {
  // matcher solution for public, api, assets and _next exclusion
  matcher: '/((?!api|static|.*\\..*|_next).*)',
}
