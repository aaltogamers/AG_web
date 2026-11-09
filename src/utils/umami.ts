// Umami analytics at stats.aaltogamers.fi: visit counts of tagged links, and
// /link/<slug> visits, which redirect before the tracking script can load
import moment from 'moment-timezone'
import { EVENT_TIMEZONE } from './eventUtils'
import { DailyVisitors, LinkStats, SITE_URL, TaggedLinkStats, statsPath } from './taggedLinks'

const UMAMI_URL = 'https://stats.aaltogamers.fi'
export const UMAMI_WEBSITE_ID = '1d896449-3521-48db-b264-1328aa7e520c'

const CACHE_MS = 5 * 60 * 1000

const statsCache = new Map<string, { at: number; stats: Promise<TaggedLinkStats | null> }>()

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const fetchUmami = async <T>(
  endpoint: string,
  path: string,
  tag: string,
  startAt: number,
  extra: Record<string, string> = {}
): Promise<T> => {
  const params = new URLSearchParams({
    startAt: String(startAt),
    endAt: String(Date.now()),
    path,
    query: `re.(^|&)ref=${escapeRegex(tag)}(&|$)`,
    ...extra,
  })
  const res = await fetch(`${UMAMI_URL}/api/websites/${UMAMI_WEBSITE_ID}/${endpoint}?${params}`, {
    headers: { Authorization: `Bearer ${process.env.UMAMI_API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Umami answered ${res.status}`)
  return (await res.json()) as T
}

const fetchStats = async (path: string, tag: string, startAt: number): Promise<LinkStats> => {
  const { visitors, visits, pageviews } = await fetchUmami<LinkStats>('stats', path, tag, startAt)
  return { visitors, visits, pageviews }
}

const firstOfLast30Days = () => moment.tz(EVENT_TIMEZONE).startOf('day').subtract(29, 'days')

// Visitors per Helsinki day of the last 30 days, oldest first. Umami leaves out days without visits.
const fetchDaily = async (path: string, tag: string): Promise<DailyVisitors[]> => {
  const firstDay = firstOfLast30Days()
  const { sessions } = await fetchUmami<{ sessions: { x: string; y: number }[] }>(
    'pageviews',
    path,
    tag,
    firstDay.valueOf(),
    { unit: 'day', timezone: EVENT_TIMEZONE }
  )
  const byDate = new Map(sessions.map((s) => [s.x.slice(0, 10), s.y]))
  return Array.from({ length: 30 }, (_, i) => {
    const date = firstDay.clone().add(i, 'days').format('YYYY-MM-DD')
    return { date, visitors: byDate.get(date) ?? 0 }
  })
}

// null when Umami isn't set up, the link is outside the site, or Umami fails
export const getTagStats = (url: string, tag: string): Promise<TaggedLinkStats | null> => {
  const path = statsPath(url)
  if (!process.env.UMAMI_API_KEY || !path || !tag) return Promise.resolve(null)
  const key = `${path}?${tag}`
  const cached = statsCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.stats
  const stats = Promise.all([
    fetchStats(path, tag, firstOfLast30Days().valueOf()),
    fetchStats(path, tag, 0),
    fetchDaily(path, tag),
  ])
    .then(([last30Days, allTime, daily]) => ({ last30Days, allTime, daily }))
    .catch((err) => {
      console.error('[umami] stats failed:', err)
      statsCache.delete(key)
      return null
    })
  statsCache.set(key, { at: Date.now(), stats })
  return stats
}

// Azure gives the client's address with a port, e.g. 1.2.3.4:5678
const clientIp = (headers: Headers) => {
  const raw = (headers.get('x-client-ip') ?? headers.get('x-forwarded-for') ?? '')
    .split(',')[0]
    .trim()
  return raw.match(/^\[(.+)\]:\d+$/)?.[1] ?? raw.match(/^([\d.]+):\d+$/)?.[1] ?? (raw || undefined)
}

// Records a page view without waiting for Umami. Only in production, so
// development doesn't add to the stats.
export const trackPageView = (path: string, headers: Headers) => {
  if (process.env.NODE_ENV !== 'production') return
  const userAgent = headers.get('user-agent') ?? ''
  fetch(`${UMAMI_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent || 'Mozilla/5.0' },
    body: JSON.stringify({
      type: 'event',
      payload: {
        website: UMAMI_WEBSITE_ID,
        hostname: new URL(SITE_URL).hostname,
        url: path,
        referrer: headers.get('referer') ?? '',
        language: headers.get('accept-language')?.split(',')[0] ?? '',
        userAgent,
        ip: clientIp(headers),
      },
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => console.error('[umami] tracking failed:', err))
}
