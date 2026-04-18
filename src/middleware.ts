import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { isBotRequest } from './utils/botDetection'

// Dedicated pool for middleware. We intentionally do NOT import from
// `./utils/db_pg` because that module also imports `node-pg-migrate`, which
// webpack struggles to bundle for the middleware chunk.
// Migrations are still applied lazily by `/api/analytics/**` routes.
const globalForPool = globalThis as unknown as { __agMiddlewarePool?: Pool }

const getPool = (): Pool => {
  if (!globalForPool.__agMiddlewarePool) {
    globalForPool.__agMiddlewarePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    })
  }
  return globalForPool.__agMiddlewarePool
}

const trackPageView = async (path: string): Promise<void> => {
  if (!process.env.DATABASE_URL) return
  try {
    await getPool().query('INSERT INTO page_views (path) VALUES ($1)', [path])
  } catch (err) {
    console.error('[middleware] analytics insert failed:', err)
  }
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isBotRequest(req.headers)) {
    return NextResponse.next()
  }

  const urlObj = new URL(req.url)
  let path = urlObj.pathname
  urlObj.searchParams.forEach((value, key) => {
    path += `${path.includes('?') ? '&' : '?'}${key}=${value}`
  })

  event.waitUntil(trackPageView(path))

  return NextResponse.next()
}

export const config = {
  matcher: '/((?!api|static|.*\\..*|_next|admin).*)',
  runtime: 'nodejs',
}
