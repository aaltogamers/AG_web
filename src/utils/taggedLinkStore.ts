// Tagged link database access shared by the admin API (/api/admin/links) and the
// AI agent MCP server (/api/mcp)
import pool from './db_pg'
import { AgentError, requireString } from './agentApi'
import { TAG_PATTERN, TaggedLink, TaggedLinkWithStats, tagFromName, withTag } from './taggedLinks'
import { getTagStats } from './umami'

type Row = { id: string; name: string; url: string; tag: string; created_at: Date }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const toLink = (row: Row): TaggedLink => ({
  id: row.id,
  name: row.name,
  url: row.url,
  tag: row.tag,
  taggedUrl: withTag(row.url, row.tag),
  createdAt: row.created_at.toISOString(),
})

const parseUrl = (value: unknown) => {
  const raw = requireString(value, 'url')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new AgentError(400, 'url must be a full URL, e.g. https://aaltogamers.fi/link/discord')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new AgentError(400, 'url must start with https://')
  }
  url.searchParams.delete('ref')
  return url.toString()
}

const parseTag = (value: unknown) => {
  const tag = requireString(value, 'tag').toLowerCase()
  if (!TAG_PATTERN.test(tag)) {
    throw new AgentError(400, 'tag can only have lowercase letters, numbers, - and _')
  }
  return tag
}

export const listTaggedLinks = async (): Promise<TaggedLink[]> =>
  (await pool.query<Row>('SELECT * FROM tagged_links ORDER BY created_at DESC')).rows.map(toLink)

export const withStats = (links: TaggedLink[]): Promise<TaggedLinkWithStats[]> =>
  Promise.all(
    links.map(async (link) => ({ ...link, stats: await getTagStats(link.url, link.tag) }))
  )

export const getTaggedLink = async (id: string): Promise<TaggedLink | null> => {
  if (!UUID_PATTERN.test(id)) return null
  const { rows } = await pool.query<Row>('SELECT * FROM tagged_links WHERE id = $1', [id])
  return rows[0] ? toLink(rows[0]) : null
}

export const createTaggedLink = async (input: {
  name?: unknown
  url?: unknown
  tag?: unknown
}): Promise<TaggedLink> => {
  const name = requireString(input.name, 'name')
  const url = parseUrl(input.url)
  const tag = input.tag === '' ? '' : parseTag(input.tag ?? tagFromName(name))
  const { rows } = await pool.query<Row>(
    `INSERT INTO tagged_links (name, url, tag) VALUES ($1, $2, $3)
     ON CONFLICT (url, tag) DO NOTHING RETURNING *`,
    [name, url, tag]
  )
  if (!rows[0]) {
    throw new AgentError(
      409,
      tag
        ? `This link already has a saved link with the tag "${tag}"`
        : 'This link is already saved without a tag'
    )
  }
  return toLink(rows[0])
}

export const renameTaggedLink = async (id: string, name: unknown): Promise<TaggedLink | null> => {
  const newName = requireString(name, 'name')
  if (!UUID_PATTERN.test(id)) return null
  const { rows } = await pool.query<Row>(
    'UPDATE tagged_links SET name = $2 WHERE id = $1 RETURNING *',
    [id, newName]
  )
  return rows[0] ? toLink(rows[0]) : null
}

export const deleteTaggedLink = async (id: string): Promise<boolean> => {
  if (!UUID_PATTERN.test(id)) return false
  const { rowCount } = await pool.query('DELETE FROM tagged_links WHERE id = $1', [id])
  return (rowCount ?? 0) > 0
}
