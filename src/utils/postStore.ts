// Database access of scheduled posts, shared by the admin API, the posts bot
// webhook, the scheduler and the MCP server. See "Scheduled posts" in README.md.
import moment from 'moment-timezone'
import type { PoolClient } from 'pg'
import pool from './db_pg'
import { AgentError } from './agentApi'
import { randomSessionId } from './eventFiles'
import { EVENT_TIMEZONE } from './eventUtils'
import { normalizePools } from './signupPools'
import type { SignupInput } from '../types/types'
import {
  DEFAULT_SETTINGS,
  PLATFORMS,
  type Channel,
  type ChannelConfig,
  type EventChange,
  type ImageChoice,
  type Platform,
  type Post,
  type PostHistoryEntry,
  type PostImage,
  type PostInput,
  type PostStatus,
  type PostTarget,
  type SessionChange,
  type SignupFormChange,
  type SocialSettings,
  type TargetStatus,
  type TextChoice,
  type WebsiteChange,
  type WebsiteChangeStatus,
} from './social/types'
import { MAX_IMAGES } from './social/render'

// Who did something: the admin page, the AI agent, or an approver in Telegram
export type Actor = 'admin' | 'agent' | `tg:${string}`

const toISO = (d: Date | null | undefined) => (d ? d.toISOString() : null)

const withTransaction = async <T>(run: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Settings

type SettingKey = keyof SocialSettings | 'instagram'

const readSetting = async <T>(key: SettingKey): Promise<Partial<T>> => {
  const result = await pool.query<{ value: Partial<T> }>(
    'SELECT value FROM social_settings WHERE key = $1',
    [key]
  )
  return result.rows[0]?.value ?? {}
}

const writeSetting = async (key: SettingKey, value: unknown) => {
  await pool.query(
    `INSERT INTO social_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  )
}

export const getSettings = async (): Promise<SocialSettings> => {
  const [telegram, discord, website] = await Promise.all([
    readSetting<SocialSettings['telegram']>('telegram'),
    readSetting<SocialSettings['discord']>('discord'),
    readSetting<SocialSettings['website']>('website'),
  ])
  return {
    telegram: { ...DEFAULT_SETTINGS.telegram, ...telegram },
    discord: { ...DEFAULT_SETTINGS.discord, ...discord },
    website: { ...DEFAULT_SETTINGS.website, ...website },
  }
}

const idPattern = /^-?\d+$/

export const saveSettings = async (changes: Partial<SocialSettings>): Promise<SocialSettings> => {
  const current = await getSettings()
  if (changes.telegram) {
    const t = { ...current.telegram, ...changes.telegram }
    const reviewChatId = String(t.reviewChatId ?? '').trim()
    const reviewThreadId = String(t.reviewThreadId ?? '').trim()
    if (reviewChatId && !idPattern.test(reviewChatId)) {
      throw new AgentError(400, 'The review chat id must be a number like -1001234567890')
    }
    if (reviewThreadId && !/^\d+$/.test(reviewThreadId)) {
      throw new AgentError(400, 'The review topic id must be a number')
    }
    const approvers = (Array.isArray(t.approvers) ? t.approvers : [])
      .map((a) => ({ id: String(a?.id ?? '').trim(), name: String(a?.name ?? '').trim() }))
      .filter((a) => a.id)
    if (approvers.some((a) => !/^\d+$/.test(a.id))) {
      throw new AgentError(400, 'Approvers must be numeric Telegram user ids')
    }
    await writeSetting('telegram', { reviewChatId, reviewThreadId, approvers })
  }
  if (changes.discord) {
    const guildId = String(changes.discord.guildId ?? '').trim()
    if (guildId && !/^\d+$/.test(guildId)) throw new AgentError(400, 'The server id must be a number')
    await writeSetting('discord', { guildId })
  }
  if (changes.website) {
    const w = { ...current.website, ...changes.website }
    const baseUrl = String(w.baseUrl ?? '')
      .trim()
      .replace(/\/+$/, '')
    if (!/^https?:\/\/\S+$/.test(baseUrl)) {
      throw new AgentError(400, 'The base URL must start with https://')
    }
    const leadMinutes = Number(w.leadMinutes)
    if (!Number.isInteger(leadMinutes) || leadMinutes < 0) {
      throw new AgentError(400, 'The lead time must be a whole number of minutes')
    }
    await writeSetting('website', { baseUrl, leadMinutes })
  }
  return getSettings()
}

export type InstagramTokenState = {
  accessToken?: string
  // ISO
  expiresAt?: string
  refreshedAt?: string
  lastError?: string
  // Hash of the INSTAGRAM_ACCESS_TOKEN the stored token was renewed from. A new
  // token in the env variable replaces the stored one.
  envTokenHash?: string
  // When the review topic was last told about the token
  warnedAt?: string
}

export const getInstagramTokenState = () => readSetting<InstagramTokenState>('instagram')

export const saveInstagramTokenState = async (changes: InstagramTokenState) =>
  writeSetting('instagram', { ...(await getInstagramTokenState()), ...changes })

export const isApprover = (settings: SocialSettings, tgUserId: string | number) =>
  settings.telegram.approvers.some((a) => a.id === String(tgUserId))

export const describeActor = (actor: string, settings?: SocialSettings) => {
  if (actor === 'admin') return 'admin (website)'
  if (actor === 'agent') return 'AI agent'
  if (actor.startsWith('tg:')) {
    const id = actor.slice(3)
    const name = settings?.telegram.approvers.find((a) => a.id === id)?.name
    return name ? `${name} (Telegram)` : `Telegram user ${id}`
  }
  return actor
}

// Channels

type ChannelRow = {
  id: string
  platform: Platform
  name: string
  config: ChannelConfig
  ref: string
  default_footer_md: string
  enabled: boolean
  deleted_at: Date | null
}

const CHANNEL_COLUMNS = 'id, platform, name, config, ref, default_footer_md, enabled, deleted_at'

const rowToChannel = (row: ChannelRow): Channel => ({
  id: String(row.id),
  platform: row.platform,
  name: row.name,
  config: row.config ?? {},
  ref: row.ref,
  defaultFooterMd: row.default_footer_md,
  enabled: row.enabled && !row.deleted_at,
  deleted: !!row.deleted_at,
})

// All channels, including deleted ones so that old posts stay readable
export const listChannels = async (): Promise<Channel[]> => {
  const result = await pool.query<ChannelRow>(
    `SELECT ${CHANNEL_COLUMNS} FROM social_channels ORDER BY platform, lower(name)`
  )
  return result.rows.map(rowToChannel)
}

export const getChannel = async (id: string): Promise<Channel | null> => {
  if (!/^\d+$/.test(id)) return null
  const result = await pool.query<ChannelRow>(
    `SELECT ${CHANNEL_COLUMNS} FROM social_channels WHERE id = $1`,
    [id]
  )
  return result.rows[0] ? rowToChannel(result.rows[0]) : null
}

export type ChannelInput = {
  platform?: Platform
  name?: string
  config?: ChannelConfig
  ref?: string
  defaultFooterMd?: string
  enabled?: boolean
}

const toRef = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const parseChannelConfig = (platform: Platform, raw: ChannelConfig | undefined): ChannelConfig => {
  const config = raw ?? {}
  if (platform === 'telegram') {
    const chatId = String(config.chatId ?? '').trim()
    const threadId = String(config.threadId ?? '').trim()
    if (!idPattern.test(chatId) && !/^@\w{4,}$/.test(chatId)) {
      throw new AgentError(400, 'The Telegram chat id must be a number like -1001234567890 or @channelname')
    }
    if (threadId && !/^\d+$/.test(threadId)) {
      throw new AgentError(400, 'The Telegram topic id must be a number')
    }
    return { chatId, ...(threadId && { threadId }) }
  }
  if (platform === 'discord') {
    const channelId = String(config.channelId ?? '').trim()
    if (!/^\d+$/.test(channelId)) throw new AgentError(400, 'Pick a Discord channel')
    return { channelId, crosspost: !!config.crosspost }
  }
  return { linkInBio: !!config.linkInBio }
}

const uniqueNameError = (err: unknown) =>
  (err as { code?: string })?.code === '23505'
    ? new AgentError(409, 'Another channel of this platform already has that name')
    : err

export const createChannel = async (input: ChannelInput): Promise<Channel> => {
  const platform = PLATFORMS.find((p) => p === input.platform)
  if (!platform) throw new AgentError(400, `platform must be one of ${PLATFORMS.join(', ')}`)
  const name = String(input.name ?? '').trim()
  if (!name) throw new AgentError(400, 'The channel needs a name')
  const ref = toRef(String(input.ref ?? '').trim() || `${platform}-${name}`)
  try {
    const result = await pool.query<ChannelRow>(
      `INSERT INTO social_channels (platform, name, config, ref, default_footer_md, enabled)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6) RETURNING ${CHANNEL_COLUMNS}`,
      [
        platform,
        name,
        JSON.stringify(parseChannelConfig(platform, input.config)),
        ref,
        String(input.defaultFooterMd ?? '').trim(),
        input.enabled ?? true,
      ]
    )
    return rowToChannel(result.rows[0])
  } catch (err) {
    throw uniqueNameError(err)
  }
}

export const updateChannel = async (id: string, input: ChannelInput): Promise<Channel> => {
  const channel = await getChannel(id)
  if (!channel || channel.deleted) throw new AgentError(404, 'No such channel')
  const name = input.name === undefined ? channel.name : String(input.name).trim()
  if (!name) throw new AgentError(400, 'The channel needs a name')
  try {
    const result = await pool.query<ChannelRow>(
      `UPDATE social_channels SET name = $2, config = $3::jsonb, ref = $4, default_footer_md = $5,
         enabled = $6
       WHERE id = $1 RETURNING ${CHANNEL_COLUMNS}`,
      [
        id,
        name,
        JSON.stringify(
          input.config === undefined
            ? channel.config
            : parseChannelConfig(channel.platform, input.config)
        ),
        input.ref === undefined ? channel.ref : toRef(String(input.ref)) || channel.ref,
        input.defaultFooterMd === undefined
          ? channel.defaultFooterMd
          : String(input.defaultFooterMd).trim(),
        input.enabled ?? channel.enabled,
      ]
    )
    return rowToChannel(result.rows[0])
  } catch (err) {
    throw uniqueNameError(err)
  }
}

// Channels that already have posts are only disabled, so the history stays readable
export const deleteChannel = async (id: string): Promise<'deleted' | 'disabled'> => {
  const used = await pool.query('SELECT 1 FROM post_targets WHERE channel_id = $1 LIMIT 1', [id])
  if (used.rows.length) {
    await pool.query(
      'UPDATE social_channels SET enabled = false, deleted_at = now() WHERE id = $1',
      [id]
    )
    return 'disabled'
  }
  await pool.query('DELETE FROM social_channels WHERE id = $1', [id])
  return 'deleted'
}

// Telegram chats the posts bot knows

export type KnownChat = {
  chatId: string
  threadId: string
  title: string
  type: string
  seenAt: string
}

export const upsertKnownChat = async (chat: Omit<KnownChat, 'seenAt'>) => {
  await pool.query(
    `INSERT INTO tg_known_chats (chat_id, thread_id, title, type, seen_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (chat_id, thread_id) DO UPDATE SET
       title = CASE WHEN EXCLUDED.title = '' THEN tg_known_chats.title ELSE EXCLUDED.title END,
       type = EXCLUDED.type, seen_at = now()`,
    [chat.chatId, chat.threadId, chat.title, chat.type]
  )
}

export const forgetKnownChat = async (chatId: string) => {
  await pool.query('DELETE FROM tg_known_chats WHERE chat_id = $1', [chatId])
}

export const listKnownChats = async (): Promise<KnownChat[]> => {
  const result = await pool.query<{
    chat_id: string
    thread_id: string
    title: string
    type: string
    seen_at: Date
  }>('SELECT chat_id, thread_id, title, type, seen_at FROM tg_known_chats ORDER BY seen_at DESC')
  return result.rows.map((r) => ({
    chatId: r.chat_id,
    threadId: r.thread_id,
    title: r.title,
    type: r.type,
    seenAt: r.seen_at.toISOString(),
  }))
}

// Telegram users who have opened the task board, for picking approvers
export const listTgUsers = async () => {
  const result = await pool.query<{
    tg_user_id: string
    first_name: string
    last_name: string | null
    username: string | null
  }>(
    `SELECT DISTINCT ON (tg_user_id) tg_user_id, first_name, last_name, username
     FROM tg_users ORDER BY tg_user_id, updated_at DESC`
  )
  return result.rows
    .map((r) => ({
      id: r.tg_user_id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' '),
      username: r.username ?? undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Posts

type PostRow = {
  id: string
  title: string
  body_md: string
  event_slug: string | null
  status: PostStatus
  version: number
  approved_version: number | null
  approved_by: string | null
  approved_at: Date | null
  send_at: Date | null
  created_by: string
  updated_by: string
  created_at: Date
  updated_at: Date
}

type TargetRow = {
  id: string
  post_id: string
  channel_id: string
  send_at: Date | null
  body_override_md: string | null
  footer_override_md: string | null
  status: TargetStatus
  external_message_id: string | null
  sent_at: Date | null
  error: string | null
  attempts: number
}

type WebsiteChangeRow = {
  post_id: string
  run_at: Date | null
  scheduled_run_at: Date | null
  kind: WebsiteChange['kind']
  event_slug: string | null
  event: EventChange
  signup_forms: SignupFormChange[]
  base: Record<string, unknown> | null
  status: WebsiteChangeStatus
  commit_sha: string | null
  event_saved_at: Date | null
  error: string | null
  attempts: number
  ran_at: Date | null
}

type ImageRow = {
  post_id: string
  media_id: string | null
  site_path: string | null
  width: number | null
  height: number | null
}

const POST_COLUMNS = `id, title, body_md, event_slug, status, version, approved_version, approved_by,
  approved_at, send_at, created_by, updated_by, created_at, updated_at`
const TARGET_COLUMNS = `id, post_id, channel_id, send_at, body_override_md, footer_override_md, status,
  external_message_id, sent_at, error, attempts`

const rowToTarget = (row: TargetRow): PostTarget => ({
  id: String(row.id),
  channelId: String(row.channel_id),
  sendAt: toISO(row.send_at),
  bodyOverrideMd: row.body_override_md,
  footerOverrideMd: row.footer_override_md,
  status: row.status,
  externalMessageId: row.external_message_id,
  sentAt: toISO(row.sent_at),
  error: row.error,
  attempts: row.attempts,
})

const rowToWebsiteChange = (row: WebsiteChangeRow): WebsiteChange => ({
  kind: row.kind,
  eventSlug: row.event_slug,
  runAt: toISO(row.run_at),
  event: row.event ?? {},
  signupForms: row.signup_forms ?? [],
  status: row.status,
  commitSha: row.commit_sha,
  error: row.error,
  ranAt: toISO(row.ran_at),
})

const rowToImage = (row: ImageRow): PostImage =>
  row.media_id
    ? {
        mediaId: row.media_id,
        ...(row.width && { width: row.width }),
        ...(row.height && { height: row.height }),
      }
    : { sitePath: row.site_path ?? '' }

const loadPosts = async (rows: PostRow[]): Promise<Post[]> => {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const [images, targets, changes] = await Promise.all([
    pool.query<ImageRow>(
      `SELECT i.post_id, i.media_id, i.site_path, m.width, m.height
       FROM post_images i LEFT JOIN post_media m ON m.id = i.media_id
       WHERE i.post_id = ANY($1) ORDER BY i.position`,
      [ids]
    ),
    pool.query<TargetRow>(
      `SELECT ${TARGET_COLUMNS} FROM post_targets WHERE post_id = ANY($1) ORDER BY position, id`,
      [ids]
    ),
    pool.query<WebsiteChangeRow>('SELECT * FROM post_website_changes WHERE post_id = ANY($1)', [
      ids,
    ]),
  ])
  return rows.map((row) => {
    const change = changes.rows.find((c) => String(c.post_id) === String(row.id))
    return {
      id: String(row.id),
      title: row.title,
      bodyMd: row.body_md,
      eventSlug: row.event_slug,
      status: row.status,
      version: row.version,
      approvedVersion: row.approved_version,
      approvedBy: row.approved_by,
      approvedAt: toISO(row.approved_at),
      sendAt: toISO(row.send_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      images: images.rows.filter((i) => String(i.post_id) === String(row.id)).map(rowToImage),
      targets: targets.rows.filter((t) => String(t.post_id) === String(row.id)).map(rowToTarget),
      websiteChange: change ? rowToWebsiteChange(change) : null,
    }
  })
}

export const getPost = async (id: string): Promise<Post | null> => {
  if (!/^\d+$/.test(id)) return null
  const result = await pool.query<PostRow>(`SELECT ${POST_COLUMNS} FROM posts WHERE id = $1`, [id])
  return (await loadPosts(result.rows))[0] ?? null
}

export const getPostOrThrow = async (id: string): Promise<Post> => {
  const post = await getPost(id)
  if (!post) throw new AgentError(404, `No post with id "${id}"`)
  return post
}

// The base of a website change, stored at approval to detect conflicts
export const getWebsiteChangeBase = async (postId: string) => {
  const result = await pool.query<{ base: Record<string, unknown> | null; event_saved_at: Date | null }>(
    'SELECT base, event_saved_at FROM post_website_changes WHERE post_id = $1',
    [postId]
  )
  return {
    base: result.rows[0]?.base ?? null,
    eventSaved: !!result.rows[0]?.event_saved_at,
  }
}

// When a channel's message goes out
export const targetSendAt = (post: Post, target: PostTarget) => target.sendAt ?? post.sendAt

// When the website change runs: its own time, or the lead time before the first message
export const websiteRunAt = (post: Post, leadMinutes: number): string | null => {
  const change = post.websiteChange
  if (!change) return null
  if (change.runAt) return change.runAt
  const times = post.targets
    .filter((t) => t.status !== 'cancelled')
    .map((t) => targetSendAt(post, t))
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime())
  if (!times.length) return null
  return new Date(Math.min(...times) - leadMinutes * 60_000).toISOString()
}

export type PostFilter = {
  statuses?: PostStatus[]
  eventSlug?: string
  // Posts with a send time or website change in the range (ISO)
  from?: string
  to?: string
}

export const listPosts = async (filter: PostFilter = {}): Promise<Post[]> => {
  const conditions: string[] = []
  const params: unknown[] = []
  if (filter.statuses?.length) {
    params.push(filter.statuses)
    conditions.push(`status = ANY($${params.length})`)
  }
  if (filter.eventSlug) {
    params.push(filter.eventSlug)
    conditions.push(`event_slug = $${params.length}`)
  }
  const result = await pool.query<PostRow>(
    `SELECT ${POST_COLUMNS} FROM posts
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY updated_at DESC LIMIT 500`,
    params
  )
  const posts = await loadPosts(result.rows)
  if (!filter.from && !filter.to) return posts
  const from = filter.from ? new Date(filter.from).getTime() : -Infinity
  const to = filter.to ? new Date(filter.to).getTime() : Infinity
  return posts.filter((post) =>
    [
      ...post.targets.map((t) => targetSendAt(post, t)),
      post.websiteChange?.runAt ?? null,
    ].some((t) => t && new Date(t).getTime() >= from && new Date(t).getTime() <= to)
  )
}

export const countAwaitingApproval = async (): Promise<number> => {
  const result = await pool.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM posts WHERE status = 'awaiting_approval'"
  )
  return result.rows[0].count
}

export const getPostHistory = async (postId: string): Promise<PostHistoryEntry[]> => {
  const result = await pool.query<{
    version: number
    action: string
    actor: string
    comment: string | null
    created_at: Date
  }>(
    'SELECT version, action, actor, comment, created_at FROM post_events WHERE post_id = $1 ORDER BY id',
    [postId]
  )
  return result.rows.map((r) => ({
    version: r.version,
    action: r.action,
    actor: r.actor,
    comment: r.comment,
    createdAt: r.created_at.toISOString(),
  }))
}

export const addPostEvent = async (
  postId: string,
  version: number,
  action: string,
  actor: string,
  comment?: string | null,
  client: PoolClient | typeof pool = pool
) => {
  await client.query(
    'INSERT INTO post_events (post_id, version, action, actor, comment) VALUES ($1, $2, $3, $4, $5)',
    [postId, version, action, actor, comment ?? null]
  )
}

// Saves a reject reason given later (a reply to the bot's "reason?" message)
export const setLatestRejectComment = async (postId: string, comment: string) => {
  await pool.query(
    `UPDATE post_events SET comment = $2 WHERE id = (
       SELECT id FROM post_events WHERE post_id = $1 AND action = 'rejected' ORDER BY id DESC LIMIT 1
     )`,
    [postId, comment]
  )
}

// Input checks shared by the admin API and the MCP tools

const parseIsoTime = (value: unknown, name: string): string | null => {
  if (value === null || value === undefined || value === '') return null
  const time = moment(String(value), moment.ISO_8601, true)
  if (!time.isValid()) throw new AgentError(400, `${name} must be a time, got "${value}"`)
  return time.toISOString()
}

// Event content times: Helsinki wall-clock, YYYY-MM-DDTHH:mm:ss
const parseContentTime = (value: unknown, name: string): string => {
  const time = moment.tz(
    String(value ?? ''),
    ['YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DDTHH:mm'],
    true,
    EVENT_TIMEZONE
  )
  if (!time.isValid()) throw new AgentError(400, `${name} must be a time like 2026-10-24T18:00`)
  return time.format('YYYY-MM-DDTHH:mm:ss')
}

const SITE_PATH = /^\/[A-Za-z0-9._\-/ ]+\.(png|jpe?g|webp|gif)$/i

export const isSafeSitePath = (path: string) => SITE_PATH.test(path) && !path.includes('..')

const parseImages = async (raw: PostImage[]): Promise<PostImage[]> => {
  if (!Array.isArray(raw)) throw new AgentError(400, 'images must be a list')
  if (raw.length > MAX_IMAGES) throw new AgentError(400, `A post can have at most ${MAX_IMAGES} images`)
  const images = raw.map((img, i): PostImage => {
    if (img && 'mediaId' in img && img.mediaId) return { mediaId: String(img.mediaId) }
    if (img && 'sitePath' in img && img.sitePath) {
      const sitePath = String(img.sitePath).trim()
      if (!isSafeSitePath(sitePath)) {
        throw new AgentError(400, `images[${i}]: "${sitePath}" is not a site image path like /images/foo.png`)
      }
      return { sitePath }
    }
    throw new AgentError(400, `images[${i}] must have a mediaId or a sitePath`)
  })
  const mediaIds = images.flatMap((i) => ('mediaId' in i ? [i.mediaId] : []))
  if (mediaIds.length) {
    const valid = mediaIds.every((id) => /^[0-9a-f-]{36}$/i.test(id))
    const found = valid
      ? await pool.query<{ id: string }>('SELECT id FROM post_media WHERE id = ANY($1::uuid[])', [
          mediaIds,
        ])
      : { rows: [] }
    const missing = mediaIds.filter((id) => !found.rows.some((r) => r.id === id))
    if (missing.length) throw new AgentError(400, `Unknown uploaded images: ${missing.join(', ')}`)
  }
  return images
}

const parseTextChoice = (raw: unknown, name: string): TextChoice => {
  const value = raw as Partial<{ fromPost: boolean; text: string }>
  if (value?.fromPost) return { fromPost: true }
  if (typeof value?.text === 'string') return { text: value.text }
  throw new AgentError(400, `${name} must be { fromPost: true } or { text }`)
}

const parseImageChoice = (raw: unknown, imageCount: number): ImageChoice | null => {
  if (raw === null) return null
  const value = raw as Partial<{ postImage: number; sitePath: string }>
  if (typeof value?.postImage === 'number') {
    if (!Number.isInteger(value.postImage) || value.postImage < 0 || value.postImage >= imageCount) {
      throw new AgentError(400, `event.image.postImage must be the position of one of the post's ${imageCount} images, from 0`)
    }
    return { postImage: value.postImage }
  }
  if (typeof value?.sitePath === 'string' && isSafeSitePath(value.sitePath.trim())) {
    return { sitePath: value.sitePath.trim() }
  }
  throw new AgentError(400, 'event.image must be { postImage: <position> } or { sitePath: "/images/..." }')
}

const parseSessions = (raw: unknown): SessionChange[] => {
  if (!Array.isArray(raw)) throw new AgentError(400, 'event.sessions must be a list')
  return raw.map((s, i) => {
    const session = (s ?? {}) as Partial<SessionChange>
    const start = parseContentTime(session.start, `event.sessions[${i}].start`)
    const end = session.end
      ? parseContentTime(session.end, `event.sessions[${i}].end`)
      : moment.tz(start, EVENT_TIMEZONE).add(2, 'hours').format('YYYY-MM-DDTHH:mm:ss')
    if (end < start) throw new AgentError(400, `event.sessions[${i}].end is before its start`)
    const location = String(session.location ?? '').trim()
    if (!location) throw new AgentError(400, `event.sessions[${i}].location is required`)
    const id = String(session.id ?? '').trim()
    if (id && !/^[a-z0-9]+$/i.test(id)) throw new AgentError(400, `event.sessions[${i}].id is not valid`)
    const name = String(session.name ?? '').trim()
    return { id: id || randomSessionId(), ...(name && { name }), start, end, location }
  })
}

const parseEventChange = (raw: EventChange, imageCount: number): EventChange => {
  const event: EventChange = {}
  if (raw.name !== undefined) {
    const name = String(raw.name).trim()
    if (!name) throw new AgentError(400, 'event.name must not be empty')
    event.name = name
  }
  if (raw.sessions !== undefined) event.sessions = parseSessions(raw.sessions)
  if (raw.signupMode !== undefined) {
    if (!['none', 'event', 'session'].includes(raw.signupMode)) {
      throw new AgentError(400, 'event.signupMode must be none, event or session')
    }
    event.signupMode = raw.signupMode
  }
  if (raw.image !== undefined) event.image = parseImageChoice(raw.image, imageCount)
  if (raw.visibleOnCalendar !== undefined) event.visibleOnCalendar = !!raw.visibleOnCalendar
  if (raw.visibleOnEventsPage !== undefined) event.visibleOnEventsPage = !!raw.visibleOnEventsPage
  if (raw.description !== undefined) {
    event.description = parseTextChoice(raw.description, 'event.description')
  }
  if (raw.body !== undefined) event.body = parseTextChoice(raw.body, 'event.body')
  return event
}

// Keeps given field ids and gives new fields max+1, like saveSignupForm
const ensureInputIds = (inputs: SignupInput[]): SignupInput[] => {
  let maxId = Math.max(0, ...inputs.map((i) => Number(i.id)).filter(Number.isFinite))
  return inputs.map((input, i) => {
    const id = Number(input.id)
    return { ...input, number: i + 1, id: Number.isFinite(id) && id > 0 ? id : ++maxId }
  })
}

const parseSignupForms = (raw: unknown): SignupFormChange[] => {
  if (!Array.isArray(raw)) throw new AgentError(400, 'signupForms must be a list')
  const seen = new Set<string>()
  return raw.map((entry, i) => {
    const { sessionId, form } = (entry ?? {}) as Partial<SignupFormChange>
    const key = sessionId ? String(sessionId) : ''
    if (seen.has(key)) throw new AgentError(400, `signupForms[${i}]: two forms for the same session`)
    seen.add(key)
    if (!form) throw new AgentError(400, `signupForms[${i}].form is required`)
    const openfrom = parseIsoTime(form.openfrom, `signupForms[${i}].form.openfrom`)
    const openuntil = parseIsoTime(form.openuntil, `signupForms[${i}].form.openuntil`)
    if (!openfrom || !openuntil) {
      throw new AgentError(400, `signupForms[${i}]: when sign-up opens and closes is required`)
    }
    if (openuntil <= openfrom) {
      throw new AgentError(400, `signupForms[${i}]: sign-up must close after it opens`)
    }
    const pools = normalizePools(form.pools)
    if (pools.some((p) => p.private && !p.password)) {
      throw new AgentError(400, `signupForms[${i}]: private pools need a password`)
    }
    const confirmedLink = String(form.confirmedLink ?? '').trim()
    if (confirmedLink && !/^https?:\/\/\S+$/i.test(confirmedLink)) {
      throw new AgentError(400, `signupForms[${i}]: the link for participants must start with https://`)
    }
    return {
      ...(key && { sessionId: key }),
      form: {
        openfrom,
        openuntil,
        pools,
        inputs: ensureInputIds(Array.isArray(form.inputs) ? form.inputs : []),
        confirmedMessage: String(form.confirmedMessage ?? '').trim(),
        confirmedLink,
      },
    }
  })
}

type NormalizedInput = {
  title?: string
  bodyMd?: string
  eventSlug?: string | null
  sendAt?: string | null
  images?: PostImage[]
  targets?: {
    channelId: string
    sendAt: string | null
    bodyOverrideMd: string | null
    footerOverrideMd: string | null
  }[]
  websiteChange?: {
    kind: WebsiteChange['kind']
    eventSlug: string | null
    runAt: string | null
    event: EventChange
    signupForms: SignupFormChange[]
  } | null
}

const nullableText = (value: unknown) =>
  value === null || value === undefined || String(value).trim() === '' ? null : String(value)

const normalizePostInput = async (
  input: PostInput,
  existing: Post | null
): Promise<NormalizedInput> => {
  const out: NormalizedInput = {}
  if (input.title !== undefined) out.title = String(input.title).trim().slice(0, 200)
  if (input.bodyMd !== undefined) out.bodyMd = String(input.bodyMd)
  if (input.eventSlug !== undefined) {
    const slug = nullableText(input.eventSlug)?.trim() ?? null
    if (slug && !/^[a-z0-9-]+$/.test(slug)) throw new AgentError(400, `"${slug}" is not an event slug`)
    out.eventSlug = slug
  }
  if (input.sendAt !== undefined) out.sendAt = parseIsoTime(input.sendAt, 'sendAt')
  if (input.images !== undefined) out.images = await parseImages(input.images)
  const imageCount = (out.images ?? existing?.images ?? []).length

  if (input.targets !== undefined) {
    if (!Array.isArray(input.targets)) throw new AgentError(400, 'channels must be a list')
    const channels = await listChannels()
    const ids = new Set<string>()
    out.targets = input.targets.map((t, i) => {
      const channelId = String(t?.channelId ?? '')
      const channel = channels.find((c) => c.id === channelId)
      if (!channel) throw new AgentError(400, `channels[${i}]: no channel with id "${channelId}"`)
      if (ids.has(channelId)) throw new AgentError(400, `Channel "${channel.name}" is listed twice`)
      ids.add(channelId)
      const isNew = !existing?.targets.some((e) => e.channelId === channelId)
      if (isNew && !channel.enabled) {
        throw new AgentError(400, `Channel "${channel.name}" is disabled and can't be used for new posts`)
      }
      return {
        channelId,
        sendAt: parseIsoTime(t.sendAt, `channels[${i}].sendAt`),
        bodyOverrideMd: nullableText(t.bodyOverrideMd),
        footerOverrideMd: t.footerOverrideMd === undefined ? null : (t.footerOverrideMd ?? null),
      }
    })
  }

  if (input.websiteChange !== undefined) {
    const raw = input.websiteChange
    if (raw === null) {
      out.websiteChange = null
    } else {
      if (raw.kind !== 'create_event' && raw.kind !== 'update_event') {
        throw new AgentError(400, 'websiteChange.kind must be create_event or update_event')
      }
      const eventSlug = nullableText(raw.eventSlug)?.trim() ?? null
      if (raw.kind === 'update_event' && !eventSlug) {
        throw new AgentError(400, 'websiteChange.eventSlug is required for update_event')
      }
      if (eventSlug && !/^[a-z0-9-]+$/.test(eventSlug)) {
        throw new AgentError(400, `"${eventSlug}" is not an event slug`)
      }
      out.websiteChange = {
        kind: raw.kind,
        // A new event's slug is chosen when the post is approved
        eventSlug: raw.kind === 'update_event' ? eventSlug : null,
        runAt: parseIsoTime(raw.runAt, 'websiteChange.runAt'),
        event: parseEventChange(raw.event ?? {}, imageCount),
        signupForms: parseSignupForms(raw.signupForms ?? []),
      }
      if (raw.kind === 'update_event' && out.eventSlug === undefined && !existing?.eventSlug) {
        out.eventSlug = eventSlug
      }
    }
  }
  return out
}

const LOCKED_TARGET: TargetStatus[] = ['sending', 'sent']
const LOCKED_CHANGE: WebsiteChangeStatus[] = ['sending', 'done', 'skipped']

// The post as it would be after the edit, without saving it, for the editor's live preview
export const postFromInput = async (input: PostInput, existing: Post | null): Promise<Post> => {
  const data = await normalizePostInput(input, existing)
  const now = new Date().toISOString()
  const base: Post = existing ?? {
    id: 'new',
    title: '',
    bodyMd: '',
    eventSlug: null,
    status: 'draft',
    version: 1,
    approvedVersion: null,
    approvedBy: null,
    approvedAt: null,
    sendAt: null,
    createdBy: 'admin',
    updatedBy: 'admin',
    createdAt: now,
    updatedAt: now,
    images: [],
    targets: [],
    websiteChange: null,
  }
  const lockedTargets = base.targets.filter((t) => LOCKED_TARGET.includes(t.status))
  const changeLocked = !!base.websiteChange && LOCKED_CHANGE.includes(base.websiteChange.status)
  return {
    ...base,
    title: data.title ?? base.title,
    bodyMd: data.bodyMd ?? base.bodyMd,
    eventSlug: data.eventSlug !== undefined ? data.eventSlug : base.eventSlug,
    sendAt: data.sendAt !== undefined ? data.sendAt : base.sendAt,
    images: data.images ?? base.images,
    targets: data.targets
      ? [
          ...lockedTargets,
          ...data.targets
            .filter((t) => !lockedTargets.some((l) => l.channelId === t.channelId))
            .map((t) => ({
              ...t,
              status: base.targets.find((e) => e.channelId === t.channelId)?.status ?? ('pending' as const),
            })),
        ]
      : base.targets,
    websiteChange:
      changeLocked || data.websiteChange === undefined
        ? base.websiteChange
        : data.websiteChange && {
            ...data.websiteChange,
            eventSlug: data.websiteChange.eventSlug ?? base.websiteChange?.eventSlug ?? null,
            status: base.websiteChange?.status ?? 'pending',
          },
  }
}

const writeImages = async (client: PoolClient, postId: string, images: PostImage[]) => {
  await client.query('DELETE FROM post_images WHERE post_id = $1', [postId])
  for (const [position, image] of images.entries()) {
    await client.query(
      'INSERT INTO post_images (post_id, position, media_id, site_path) VALUES ($1, $2, $3, $4)',
      [
        postId,
        position,
        'mediaId' in image ? image.mediaId : null,
        'sitePath' in image ? image.sitePath : null,
      ]
    )
  }
}

const writeTargets = async (
  client: PoolClient,
  postId: string,
  targets: NonNullable<NormalizedInput['targets']>,
  existing: PostTarget[]
) => {
  const locked = existing.filter((t) => LOCKED_TARGET.includes(t.status))
  const editable = targets.filter((t) => !locked.some((l) => l.channelId === t.channelId))
  await client.query(
    `DELETE FROM post_targets WHERE post_id = $1 AND status <> ALL($2) AND NOT (channel_id = ANY($3))`,
    [postId, LOCKED_TARGET, editable.map((t) => t.channelId)]
  )
  for (const [position, t] of targets.entries()) {
    if (locked.some((l) => l.channelId === t.channelId)) continue
    await client.query(
      `INSERT INTO post_targets (post_id, channel_id, send_at, body_override_md, footer_override_md, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (post_id, channel_id) DO UPDATE SET send_at = EXCLUDED.send_at,
         body_override_md = EXCLUDED.body_override_md,
         footer_override_md = EXCLUDED.footer_override_md, position = EXCLUDED.position`,
      [postId, t.channelId, t.sendAt, t.bodyOverrideMd, t.footerOverrideMd, position]
    )
  }
}

const writeWebsiteChange = async (
  client: PoolClient,
  postId: string,
  change: NormalizedInput['websiteChange'],
  existing: WebsiteChange | null
) => {
  if (existing && LOCKED_CHANGE.includes(existing.status)) return
  if (change === null || change === undefined) {
    if (change === null) await client.query('DELETE FROM post_website_changes WHERE post_id = $1', [postId])
    return
  }
  await client.query(
    `INSERT INTO post_website_changes (post_id, run_at, kind, event_slug, event, signup_forms, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'pending')
     ON CONFLICT (post_id) DO UPDATE SET run_at = EXCLUDED.run_at, kind = EXCLUDED.kind,
       event_slug = EXCLUDED.event_slug, event = EXCLUDED.event, signup_forms = EXCLUDED.signup_forms`,
    [
      postId,
      change.runAt,
      change.kind,
      change.eventSlug,
      JSON.stringify(change.event),
      JSON.stringify(change.signupForms),
    ]
  )
}

export const createPost = async (input: PostInput, actor: Actor): Promise<Post> => {
  const data = await normalizePostInput(input, null)
  const id = await withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO posts (title, body_md, event_slug, send_at, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
      [data.title ?? '', data.bodyMd ?? '', data.eventSlug ?? null, data.sendAt ?? null, actor]
    )
    const postId = String(result.rows[0].id)
    await writeImages(client, postId, data.images ?? [])
    await writeTargets(client, postId, data.targets ?? [], [])
    await writeWebsiteChange(client, postId, data.websiteChange, null)
    await addPostEvent(postId, 1, 'created', actor, null, client)
    return postId
  })
  return getPostOrThrow(id)
}

// Edits a post as a new version, taking it off the schedule: back to awaiting
// approval (agent) or draft (admin). Parts that have already run are kept.
export const updatePost = async (
  id: string,
  input: PostInput,
  actor: Actor,
  // The version the edit was made on, e.g. when the editor was opened
  expectedVersion?: number
): Promise<{ post: Post; previousStatus: PostStatus }> => {
  const existing = await getPostOrThrow(id)
  if (expectedVersion !== undefined && existing.version !== expectedVersion) {
    throw new AgentError(
      409,
      `The post has been edited since you opened it (now v${existing.version}). Reload it and make your changes again.`
    )
  }
  if (existing.status === 'cancelled') {
    throw new AgentError(409, 'The post has been cancelled and can no longer be edited')
  }
  const data = await normalizePostInput(input, existing)
  const nextStatus: PostStatus =
    actor === 'agent' &&
    (existing.status === 'scheduled' || existing.status === 'awaiting_approval')
      ? 'awaiting_approval'
      : 'draft'

  await withTransaction(async (client) => {
    const locked = await client.query<{ version: number }>(
      'SELECT version FROM posts WHERE id = $1 FOR UPDATE',
      [id]
    )
    if (locked.rows[0]?.version !== existing.version) {
      throw new AgentError(409, 'The post was changed at the same time, try again')
    }
    await client.query(
      `UPDATE posts SET title = $2, body_md = $3, event_slug = $4, send_at = $5, status = $6,
         version = version + 1, updated_by = $7, updated_at = now(), missed_notice_at = NULL
       WHERE id = $1`,
      [
        id,
        data.title ?? existing.title,
        data.bodyMd ?? existing.bodyMd,
        data.eventSlug !== undefined ? data.eventSlug : existing.eventSlug,
        data.sendAt !== undefined ? data.sendAt : existing.sendAt,
        nextStatus,
        actor,
      ]
    )
    if (data.images) await writeImages(client, id, data.images)
    if (data.targets) await writeTargets(client, id, data.targets, existing.targets)
    await writeWebsiteChange(client, id, data.websiteChange, existing.websiteChange)
    await addPostEvent(id, existing.version + 1, 'edited', actor, null, client)
  })
  return { post: await getPostOrThrow(id), previousStatus: existing.status }
}

// Status changes. Each checks the version, so a button on an old review does nothing.

const outOfDate = () => new AgentError(409, 'The post has been edited since, this is out of date')

export const setAwaitingApproval = async (post: Post, actor: Actor) => {
  const result = await pool.query(
    `UPDATE posts SET status = 'awaiting_approval', missed_notice_at = NULL, updated_at = now()
     WHERE id = $1 AND version = $2 AND status IN ('draft', 'awaiting_approval')`,
    [post.id, post.version]
  )
  if (!result.rowCount) throw outOfDate()
  await addPostEvent(post.id, post.version, 'approval requested', actor)
}

export const withdrawApprovalRequest = async (post: Post, actor: Actor) => {
  const result = await pool.query(
    `UPDATE posts SET status = 'draft', updated_at = now()
     WHERE id = $1 AND status = 'awaiting_approval'`,
    [post.id]
  )
  if (!result.rowCount) throw new AgentError(409, 'The post is not awaiting approval')
  await addPostEvent(post.id, post.version, 'approval request withdrawn', actor)
}

export type ApprovalData = {
  // Slug of a new event, chosen at approval
  eventSlug?: string | null
  // Values of the changed event fields now, to detect conflicts when the change runs
  base?: Record<string, unknown> | null
  scheduledRunAt?: string | null
}

export const markApproved = async (
  post: Post,
  version: number,
  actor: Actor,
  data: ApprovalData
) => {
  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE posts SET status = 'scheduled', approved_version = version, approved_by = $3,
         approved_at = now(), missed_notice_at = NULL, updated_at = now(),
         event_slug = COALESCE($4, event_slug)
       WHERE id = $1 AND version = $2 AND status IN ('draft', 'awaiting_approval')`,
      [post.id, version, actor, data.eventSlug ?? null]
    )
    if (!result.rowCount) throw outOfDate()
    await client.query(
      `UPDATE post_targets SET status = 'pending', attempts = 0, error = NULL, next_attempt_at = NULL
       WHERE post_id = $1 AND status IN ('pending', 'held', 'failed')`,
      [post.id]
    )
    await client.query(
      `UPDATE post_website_changes SET status = 'pending', attempts = 0, error = NULL,
         next_attempt_at = NULL, base = $2::jsonb, scheduled_run_at = $3,
         event_slug = COALESCE($4, event_slug)
       WHERE post_id = $1 AND status IN ('pending', 'failed', 'cancelled')`,
      [
        post.id,
        data.base ? JSON.stringify(data.base) : null,
        data.scheduledRunAt ?? null,
        data.eventSlug ?? null,
      ]
    )
    await addPostEvent(post.id, version, 'approved', actor, null, client)
  })
}

export const markRejected = async (post: Post, version: number, actor: Actor, comment?: string) => {
  const result = await pool.query(
    `UPDATE posts SET status = 'draft', updated_at = now()
     WHERE id = $1 AND version = $2 AND status = 'awaiting_approval'`,
    [post.id, version]
  )
  if (!result.rowCount) throw outOfDate()
  await addPostEvent(post.id, version, 'rejected', actor, comment || null)
}

export const markCancelled = async (post: Post, actor: Actor) => {
  await withTransaction(async (client) => {
    await client.query(`UPDATE posts SET status = 'cancelled', updated_at = now() WHERE id = $1`, [
      post.id,
    ])
    await client.query(
      `UPDATE post_targets SET status = 'cancelled' WHERE post_id = $1 AND status IN ('pending', 'held', 'failed')`,
      [post.id]
    )
    await client.query(
      `UPDATE post_website_changes SET status = 'cancelled' WHERE post_id = $1 AND status IN ('pending', 'failed')`,
      [post.id]
    )
    await addPostEvent(post.id, post.version, 'cancelled', actor, null, client)
  })
}

// Held messages: run the website change again, or send without it. Messages
// whose time has passed get `newTime` (default: now).
export const releaseHeld = async (
  post: Post,
  version: number,
  actor: Actor,
  mode: 'retry' | 'send_anyway',
  newTime: string | null,
  base: Record<string, unknown> | null
) => {
  const time = newTime ?? new Date().toISOString()
  await withTransaction(async (client) => {
    const locked = await client.query<{ version: number; approved_version: number | null; status: string }>(
      'SELECT version, approved_version, status FROM posts WHERE id = $1 FOR UPDATE',
      [post.id]
    )
    const row = locked.rows[0]
    if (!row || row.version !== version || row.approved_version !== version || row.status !== 'scheduled') {
      throw outOfDate()
    }
    const change = await client.query(
      mode === 'retry'
        ? `UPDATE post_website_changes SET status = 'pending', attempts = 0, error = NULL,
             next_attempt_at = NULL, scheduled_run_at = LEAST(COALESCE(scheduled_run_at, now()), now()),
             base = COALESCE($2::jsonb, base)
           WHERE post_id = $1 AND status = 'failed'`
        : `UPDATE post_website_changes SET status = 'skipped' WHERE post_id = $1 AND status = 'failed'`,
      mode === 'retry' ? [post.id, base ? JSON.stringify(base) : null] : [post.id]
    )
    if (!change.rowCount) throw new AgentError(409, 'The website change has not failed')
    await client.query(
      `UPDATE post_targets t SET status = 'pending', attempts = 0, error = NULL, next_attempt_at = NULL,
         send_at = CASE WHEN COALESCE(t.send_at, p.send_at) < now() THEN $2::timestamptz ELSE t.send_at END
       FROM posts p
       WHERE p.id = t.post_id AND t.post_id = $1 AND t.status = 'held'`,
      [post.id, time]
    )
    await addPostEvent(post.id, version, mode === 'retry' ? 'website change retried' : 'sent without website change', actor, null, client)
  })
}

// Scheduler queries. Claiming sets the status to `sending` in the same query,
// so nothing is sent twice even if two server instances overlap during a deploy.

const APPROVED = `p.status = 'scheduled' AND p.version = p.approved_version`

export type DueWebsiteChange = { postId: string; attempts: number }

export const claimDueWebsiteChanges = async (): Promise<DueWebsiteChange[]> => {
  const result = await pool.query<{ post_id: string; attempts: number }>(
    `WITH due AS (
       SELECT w.post_id FROM post_website_changes w JOIN posts p ON p.id = w.post_id
       WHERE w.status = 'pending' AND ${APPROVED}
         AND COALESCE(w.scheduled_run_at, w.run_at) <= now()
         AND (w.next_attempt_at IS NULL OR w.next_attempt_at <= now())
       FOR UPDATE OF w SKIP LOCKED
     )
     UPDATE post_website_changes SET status = 'sending', attempts = attempts + 1
     WHERE post_id IN (SELECT post_id FROM due)
     RETURNING post_id, attempts`
  )
  return result.rows.map((r) => ({ postId: String(r.post_id), attempts: r.attempts }))
}

// Undoes a claim, e.g. when the post was edited after it was claimed. Approving
// the post again schedules it.
export const releaseWebsiteChangeClaim = async (postId: string) => {
  await pool.query(
    `UPDATE post_website_changes SET status = 'pending', attempts = GREATEST(attempts - 1, 0)
     WHERE post_id = $1 AND status = 'sending'`,
    [postId]
  )
}

export const finishWebsiteChange = async (
  postId: string,
  result:
    | { ok: true; commitSha: string | null }
    | { ok: false; error: string; retryInMinutes?: number }
) => {
  if (result.ok) {
    await pool.query(
      `UPDATE post_website_changes SET status = 'done', commit_sha = COALESCE($2, commit_sha),
         error = NULL, ran_at = now() WHERE post_id = $1`,
      [postId, result.commitSha]
    )
    return
  }
  if (result.retryInMinutes) {
    await pool.query(
      `UPDATE post_website_changes SET status = 'pending', error = $2,
         next_attempt_at = now() + make_interval(mins => $3) WHERE post_id = $1`,
      [postId, result.error, result.retryInMinutes]
    )
    return
  }
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE post_website_changes SET status = 'failed', error = $2, ran_at = now() WHERE post_id = $1`,
      [postId, result.error]
    )
    // The messages wait for someone to decide what to do
    await client.query(
      `UPDATE post_targets SET status = 'held' WHERE post_id = $1 AND status = 'pending'`,
      [postId]
    )
  })
}

export const markEventSaved = async (postId: string, commitSha: string | null) => {
  await pool.query(
    `UPDATE post_website_changes SET event_saved_at = now(), commit_sha = $2 WHERE post_id = $1`,
    [postId, commitSha]
  )
}

// The slug of a new event, if it had to be changed when the change ran
export const setWebsiteChangeSlug = async (postId: string, slug: string) => {
  await pool.query('UPDATE post_website_changes SET event_slug = $2 WHERE post_id = $1', [
    postId,
    slug,
  ])
  await pool.query('UPDATE posts SET event_slug = $2 WHERE id = $1', [postId, slug])
}

export type DueTarget = { targetId: string; postId: string; channelId: string; attempts: number }

const MISSED_AFTER_MINUTES = 30

// Messages more than 30 min late (e.g. the server was down) are not sent
export const failMissedTargets = async (): Promise<DueTarget[]> => {
  const result = await pool.query<{ id: string; post_id: string; channel_id: string; attempts: number }>(
    `UPDATE post_targets t SET status = 'failed',
       error = 'Not sent: more than ${MISSED_AFTER_MINUTES} minutes late'
     FROM posts p
     WHERE p.id = t.post_id AND t.status = 'pending' AND ${APPROVED} AND t.attempts = 0
       AND COALESCE(t.send_at, p.send_at) < now() - interval '${MISSED_AFTER_MINUTES} minutes'
       AND NOT EXISTS (
         SELECT 1 FROM post_website_changes w
         WHERE w.post_id = p.id AND w.status IN ('pending', 'sending', 'failed')
       )
     RETURNING t.id, t.post_id, t.channel_id, t.attempts`
  )
  return result.rows.map((r) => ({
    targetId: String(r.id),
    postId: String(r.post_id),
    channelId: String(r.channel_id),
    attempts: r.attempts,
  }))
}

export const claimDueTargets = async (): Promise<DueTarget[]> => {
  const result = await pool.query<{ id: string; post_id: string; channel_id: string; attempts: number }>(
    `WITH due AS (
       SELECT t.id FROM post_targets t JOIN posts p ON p.id = t.post_id
       WHERE t.status = 'pending' AND ${APPROVED}
         AND COALESCE(t.send_at, p.send_at) <= now()
         AND (t.next_attempt_at IS NULL OR t.next_attempt_at <= now())
         -- Messages wait for the post's website change
         AND NOT EXISTS (
           SELECT 1 FROM post_website_changes w
           WHERE w.post_id = p.id AND w.status IN ('pending', 'sending', 'failed')
         )
       FOR UPDATE OF t SKIP LOCKED
     )
     UPDATE post_targets SET status = 'sending', attempts = attempts + 1
     WHERE id IN (SELECT id FROM due)
     RETURNING id, post_id, channel_id, attempts`
  )
  return result.rows.map((r) => ({
    targetId: String(r.id),
    postId: String(r.post_id),
    channelId: String(r.channel_id),
    attempts: r.attempts,
  }))
}

// Undoes a claim, e.g. when the post was edited after it was claimed
export const releaseTargetClaim = async (targetId: string) => {
  await pool.query(
    `UPDATE post_targets SET status = 'pending', attempts = GREATEST(attempts - 1, 0)
     WHERE id = $1 AND status = 'sending'`,
    [targetId]
  )
}

export const finishTarget = async (
  targetId: string,
  result:
    | { ok: true; externalMessageId: string }
    | { ok: false; error: string; retryInMinutes?: number }
) => {
  if (result.ok) {
    await pool.query(
      `UPDATE post_targets SET status = 'sent', external_message_id = $2, sent_at = now(), error = NULL
       WHERE id = $1`,
      [targetId, result.externalMessageId]
    )
  } else if (result.retryInMinutes) {
    await pool.query(
      `UPDATE post_targets SET status = 'pending', error = $2,
         next_attempt_at = now() + make_interval(mins => $3) WHERE id = $1`,
      [targetId, result.error, result.retryInMinutes]
    )
  } else {
    await pool.query(`UPDATE post_targets SET status = 'failed', error = $2 WHERE id = $1`, [
      targetId,
      result.error,
    ])
  }
}

// Claims that were interrupted, e.g. by a restart while sending. They may or may
// not have gone out, so they are failed and reported instead of sent again.
export const failStuckSending = async () => {
  const targets = await pool.query<{ id: string; post_id: string; channel_id: string; attempts: number }>(
    `UPDATE post_targets t SET status = 'failed', error = 'Interrupted while sending; check whether it went out'
     FROM posts p
     WHERE p.id = t.post_id AND t.status = 'sending'
       AND COALESCE(t.next_attempt_at, t.send_at, p.send_at) < now() - interval '15 minutes'
     RETURNING t.id, t.post_id, t.channel_id, t.attempts`
  )
  const changes = await pool.query<{ post_id: string }>(
    `UPDATE post_website_changes SET status = 'failed', error = 'Interrupted while running; check the event and try again'
     WHERE status = 'sending'
       AND COALESCE(next_attempt_at, scheduled_run_at, run_at) < now() - interval '15 minutes'
     RETURNING post_id`
  )
  if (changes.rows.length) {
    await pool.query(
      `UPDATE post_targets SET status = 'held' WHERE post_id = ANY($1) AND status = 'pending'`,
      [changes.rows.map((r) => r.post_id)]
    )
  }
  return {
    targets: targets.rows.map((r) => ({
      targetId: String(r.id),
      postId: String(r.post_id),
      channelId: String(r.channel_id),
      attempts: r.attempts,
    })),
    changes: changes.rows.map((r) => String(r.post_id)),
  }
}

// Scheduled posts whose every part has been sent or has failed become done
export const finishDonePosts = async (): Promise<string[]> => {
  const result = await pool.query<{ id: string }>(
    `UPDATE posts p SET status = 'done', updated_at = now()
     WHERE p.status = 'scheduled'
       AND NOT EXISTS (
         SELECT 1 FROM post_targets t
         WHERE t.post_id = p.id AND t.status IN ('pending', 'sending', 'held')
       )
       AND NOT EXISTS (
         SELECT 1 FROM post_website_changes w
         WHERE w.post_id = p.id AND w.status IN ('pending', 'sending', 'failed')
       )
     RETURNING p.id`
  )
  for (const row of result.rows) {
    const post = await pool.query<{ version: number }>('SELECT version FROM posts WHERE id = $1', [row.id])
    await addPostEvent(String(row.id), post.rows[0].version, 'done', 'scheduler')
  }
  return result.rows.map((r) => String(r.id))
}

// Posts still awaiting approval when their first part should have run.
// Each is returned once (until it is edited or approved).
export const claimMissedApprovals = async (leadMinutes: number): Promise<string[]> => {
  const result = await pool.query<{ id: string }>(
    `UPDATE posts p SET missed_notice_at = now()
     WHERE p.status = 'awaiting_approval' AND p.missed_notice_at IS NULL
       AND LEAST(
         (SELECT MIN(COALESCE(t.send_at, p.send_at)) FROM post_targets t WHERE t.post_id = p.id),
         (SELECT COALESCE(w.run_at, (
            SELECT MIN(COALESCE(t.send_at, p.send_at)) FROM post_targets t WHERE t.post_id = p.id
          ) - make_interval(mins => $1))
          FROM post_website_changes w WHERE w.post_id = p.id)
       ) <= now()
     RETURNING p.id`,
    [leadMinutes]
  )
  return result.rows.map((r) => String(r.id))
}

// Review topic messages

export type PreviewMessageKind = 'summary' | 'notice' | 'reason_prompt'

export const savePreviewMessage = async (msg: {
  postId: string
  version: number
  chatId: string
  messageId: number
  kind: PreviewMessageKind
  text: string
  actor?: string
}) => {
  await pool.query(
    `INSERT INTO tg_preview_messages (post_id, version, chat_id, message_id, kind, text, actor)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [msg.postId, msg.version, msg.chatId, msg.messageId, msg.kind, msg.text, msg.actor ?? null]
  )
}

export type PreviewMessage = {
  postId: string
  version: number
  chatId: string
  messageId: number
  kind: PreviewMessageKind
  text: string
  actor: string | null
}

const rowToPreviewMessage = (r: {
  post_id: string
  version: number
  chat_id: string
  message_id: string
  kind: PreviewMessageKind
  text: string
  actor: string | null
}): PreviewMessage => ({
  postId: String(r.post_id),
  version: r.version,
  chatId: r.chat_id,
  messageId: Number(r.message_id),
  kind: r.kind,
  text: r.text,
  actor: r.actor,
})

// Messages with buttons of a post that are still open: summaries and notices
export const getOpenPreviewMessages = async (postId: string): Promise<PreviewMessage[]> => {
  const result = await pool.query(
    `SELECT post_id, version, chat_id, message_id, kind, text, actor FROM tg_preview_messages
     WHERE post_id = $1 AND kind IN ('summary', 'notice') ORDER BY id`,
    [postId]
  )
  return result.rows.map(rowToPreviewMessage)
}

export const deletePreviewMessage = async (chatId: string, messageId: number) => {
  await pool.query('DELETE FROM tg_preview_messages WHERE chat_id = $1 AND message_id = $2', [
    chatId,
    messageId,
  ])
}

export const findPreviewMessage = async (
  chatId: string,
  messageId: number
): Promise<PreviewMessage | null> => {
  const result = await pool.query(
    `SELECT post_id, version, chat_id, message_id, kind, text, actor FROM tg_preview_messages
     WHERE chat_id = $1 AND message_id = $2`,
    [chatId, messageId]
  )
  return result.rows[0] ? rowToPreviewMessage(result.rows[0]) : null
}

// Uploaded images

export const saveMedia = async (data: Buffer, width: number, height: number) => {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO post_media (data, content_type, width, height) VALUES ($1, 'image/jpeg', $2, $3)
     RETURNING id`,
    [data, width, height]
  )
  return { mediaId: result.rows[0].id, width, height }
}

export const getMedia = async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const result = await pool.query<{ data: Buffer; content_type: string; width: number; height: number }>(
    'SELECT data, content_type, width, height FROM post_media WHERE id = $1',
    [id]
  )
  return result.rows[0] ?? null
}

// Uploads that never ended up in a post
export const deleteUnusedMedia = async () => {
  await pool.query(
    `DELETE FROM post_media m WHERE m.created_at < now() - interval '2 days'
       AND NOT EXISTS (SELECT 1 FROM post_images i WHERE i.media_id = m.id)`
  )
}
