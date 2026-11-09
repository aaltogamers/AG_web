// Links with a statistics tag (?ref=<tag>), e.g. for a poster's QR code. Shared
// by the admin page, its API and the MCP tools. See "Links and QR codes" in README.md.
export const SITE_URL = 'https://aaltogamers.fi'

export const TAG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/

export type TaggedLink = {
  id: string
  name: string
  url: string
  tag: string
  taggedUrl: string
  createdAt: string
}

export type LinkStats = { visitors: number; visits: number; pageviews: number }
export type DailyVisitors = { date: string; visitors: number }
export type TaggedLinkStats = { last30Days: LinkStats; allTime: LinkStats; daily: DailyVisitors[] }
export type TaggedLinkWithStats = TaggedLink & { stats: TaggedLinkStats | null }

export const withTag = (url: string, tag: string) => {
  if (!tag) return url
  try {
    const u = new URL(url)
    u.searchParams.set('ref', tag)
    return u.toString()
  } catch {
    return url
  }
}

// The path Umami records visits under, or null for links outside the site
export const statsPath = (url: string): string | null => {
  try {
    const u = new URL(url)
    if (u.hostname.replace(/^www\./, '') !== new URL(SITE_URL).hostname) return null
    return u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : u.pathname
  } catch {
    return null
  }
}

export const qrPageUrl = (id: string) => `${SITE_URL}/admin/links?link=${id}`

// "Otaniemi events" -> "otaniemi-events"
export const tagFromName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '')
