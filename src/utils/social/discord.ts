// Discord bot: sends and publishes posts, lists the server's channels
import type { LoadedImage } from './media'
import type { DiscordChannelConfig } from './types'

const API = 'https://discord.com/api/v10'

export class DiscordError extends Error {
  constructor(
    message: string,
    public status?: number,
    // Seconds, on 429
    public retryAfter?: number
  ) {
    super(message)
  }
}

export const isDiscordConfigured = () => !!process.env.DISCORD_BOT_TOKEN

const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new DiscordError('DISCORD_BOT_TOKEN is not set')
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, ...init.headers },
  })
  if (res.status === 204) return undefined as T
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; retry_after?: number }
  if (!res.ok) {
    throw new DiscordError(
      `Discord: ${body.message ?? `HTTP ${res.status}`}`,
      res.status,
      body.retry_after
    )
  }
  return body
}

type DiscordChannel = {
  id: string
  name: string
  // 0 text, 4 category, 5 announcement
  type: number
  parent_id?: string | null
  position: number
  guild_id?: string
  permission_overwrites?: { id: string; type: number; allow: string; deny: string }[]
}

const TEXT = 0
const CATEGORY = 4
const ANNOUNCEMENT = 5

// Text and announcement channels, with their category, for the settings dropdown
export const listGuildChannels = async (guildId: string) => {
  const channels = await call<DiscordChannel[]>(`/guilds/${guildId}/channels`)
  const categories = new Map(
    channels.filter((c) => c.type === CATEGORY).map((c) => [c.id, c.name])
  )
  return channels
    .filter((c) => c.type === TEXT || c.type === ANNOUNCEMENT)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      name: c.name,
      category: (c.parent_id && categories.get(c.parent_id)) || null,
      announcement: c.type === ANNOUNCEMENT,
    }))
}

export const sendToDiscordChannel = async (
  config: DiscordChannelConfig,
  markdown: string,
  images: LoadedImage[]
): Promise<{ id: string; warning?: string }> => {
  const payload = {
    content: markdown,
    // Never ping anyone, even if the text has @everyone or a role mention
    allowed_mentions: { parse: [] },
    attachments: images.map((image, i) => ({ id: i, filename: image.filename })),
  }
  const form = new FormData()
  form.append('payload_json', JSON.stringify(payload))
  images.forEach((image, i) =>
    form.append(`files[${i}]`, new Blob([new Uint8Array(image.data)], { type: image.contentType }), image.filename)
  )
  const message = await call<{ id: string; channel_id: string }>(
    `/channels/${config.channelId}/messages`,
    { method: 'POST', body: form }
  )
  if (config.crosspost) {
    // Publishes the message to servers following the announcement channel. The
    // message has been sent already, so a failure here must not send it again.
    try {
      await call(`/channels/${config.channelId}/messages/${message.id}/crosspost`, {
        method: 'POST',
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return { id: message.id, warning: `Sent, but publishing it to following servers failed: ${error}` }
    }
  }
  return { id: message.id }
}

// Permission bits
const ADMINISTRATOR = BigInt(1) << BigInt(3)
const VIEW_CHANNEL = BigInt(1) << BigInt(10)
const SEND_MESSAGES = BigInt(1) << BigInt(11)
const EMBED_LINKS = BigInt(1) << BigInt(14)
const ATTACH_FILES = BigInt(1) << BigInt(15)

// Checks that the bot can see and post in the channel, without posting anything
export const testDiscordChannel = async (
  guildId: string,
  config: DiscordChannelConfig
): Promise<{ ok: boolean; problems: string[] }> => {
  const problems: string[] = []
  const me = await call<{ id: string }>('/users/@me')
  const [channel, member, roles] = await Promise.all([
    call<DiscordChannel>(`/channels/${config.channelId}`).catch((err: DiscordError) => {
      if (err.status === 403 || err.status === 404) return null
      throw err
    }),
    call<{ roles: string[] }>(`/guilds/${guildId}/members/${me.id}`),
    call<{ id: string; permissions: string }[]>(`/guilds/${guildId}/roles`),
  ])
  if (!channel) return { ok: false, problems: ["The bot can't see the channel"] }
  if (channel.guild_id !== guildId) {
    return { ok: false, problems: ['The channel is not in the configured server'] }
  }

  // Server-wide permissions, then the channel's overwrites (Discord's documented order)
  const roleById = new Map(roles.map((r) => [r.id, BigInt(r.permissions)]))
  let perms = roleById.get(guildId) ?? BigInt(0)
  member.roles.forEach((id) => {
    perms |= roleById.get(id) ?? BigInt(0)
  })
  if (!(perms & ADMINISTRATOR)) {
    const overwrites = channel.permission_overwrites ?? []
    const apply = (o?: { allow: string; deny: string }) => {
      if (!o) return
      perms = (perms & ~BigInt(o.deny)) | BigInt(o.allow)
    }
    apply(overwrites.find((o) => o.id === guildId))
    let allow = BigInt(0)
    let deny = BigInt(0)
    overwrites
      .filter((o) => o.type === 0 && member.roles.includes(o.id))
      .forEach((o) => {
        allow |= BigInt(o.allow)
        deny |= BigInt(o.deny)
      })
    perms = (perms & ~deny) | allow
    apply(overwrites.find((o) => o.type === 1 && o.id === me.id))
  }

  const has = (bit: bigint) => (perms & ADMINISTRATOR) !== BigInt(0) || (perms & bit) !== BigInt(0)
  if (!has(VIEW_CHANNEL)) problems.push('missing View Channel')
  if (!has(SEND_MESSAGES)) problems.push('missing Send Messages')
  if (!has(EMBED_LINKS)) problems.push('missing Embed Links')
  if (!has(ATTACH_FILES)) problems.push('missing Attach Files (needed for images)')
  if (config.crosspost) {
    // Publishing its own messages only needs Send Messages
    if (channel.type !== ANNOUNCEMENT) problems.push('publishing only works in announcement channels')
  }
  return { ok: problems.length === 0, problems }
}
