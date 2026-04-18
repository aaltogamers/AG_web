import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'
import { isBotRequest } from './utils/botDetection'

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isBotRequest(req.headers)) {
    return NextResponse.next()
  }

  const urlObj = new URL(req.url)
  let path = urlObj.pathname
  urlObj.searchParams.forEach((value, key) => {
    path += `${path.includes('?') ? '&' : '?'}${key}=${value}`
  })

  const trackUrl = `${urlObj.protocol}//${urlObj.host}/api/analytics/track`

  // waitUntil lets the response return immediately while telling the Edge
  // runtime not to terminate before the analytics POST finishes. The response
  // to the browser is NOT blocked on this fetch.
  event.waitUntil(
    fetch(trackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    }).catch(() => {
      // swallow – analytics must never break the page
    })
  )

  return NextResponse.next()
}

export const config = {
  matcher: '/((?!api|static|.*\\..*|_next|admin).*)',
}
