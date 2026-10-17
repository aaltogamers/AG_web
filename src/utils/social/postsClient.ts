// Browser calls to the admin posts API (/api/posts/**)
import type { KnownChat } from '../postStore'
import type {
  Channel,
  ChannelConfig,
  Platform,
  Post,
  PostHistoryEntry,
  PostInput,
  PostPreview,
  PostStatus,
  SocialSettings,
} from './types'

export const request = async <T>(url: string, method = 'GET', body?: unknown): Promise<T> => {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    ...(body !== undefined && {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const fetchPosts = (statuses: PostStatus[] = [], eventSlug?: string) => {
  const params = new URLSearchParams({
    ...(statuses.length && { status: statuses.join(',') }),
    ...(eventSlug && { event: eventSlug }),
  })
  return request<{ posts: Post[]; awaitingApproval: number }>(`/api/posts${params.size ? `?${params}` : ''}`)
}

export const fetchPost = (id: string) =>
  request<{ post: Post; history: PostHistoryEntry[]; preview: PostPreview }>(`/api/posts/${id}`)

export const createPost = (post: PostInput) => request<{ post: Post }>('/api/posts', 'POST', { post })

// `version` is the version the editor loaded, so that edits made since aren't overwritten
export const savePost = (id: string, version: number, post: PostInput) =>
  request<{ post: Post; note?: string }>(`/api/posts/${id}`, 'PUT', { post, version })

export const previewPost = (id: string | null, post: PostInput) =>
  request<{ preview: PostPreview }>('/api/posts/preview', 'POST', { id: id ?? undefined, post })

// Sends one channel's text to the platform's test channel
export const sendTestPost = (id: string | null, post: PostInput, channelId: string) =>
  request<object>('/api/posts/test-send', 'POST', { id: id ?? undefined, post, channelId })

export type PostAction =
  | 'request-approval'
  | 'approve'
  | 'unschedule'
  | 'withdraw'
  | 'retry'
  | 'send-anyway'

export const postAction = (
  id: string,
  action: PostAction,
  body: { version?: number; newTime?: string | null } = {}
) => request<{ post: Post; note?: string }>(`/api/posts/${id}/${action}`, 'POST', body)

export const deletePost = (id: string) => request<object>(`/api/posts/${id}/delete`, 'POST', {})

export const uploadImage = async (file: File) => {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return request<{ mediaId: string; width: number; height: number }>('/api/posts/media', 'POST', {
    data,
  })
}

export type TgUserOption = { id: string; name: string; username?: string }

export type SettingsResponse = {
  settings: SocialSettings
  channels: Channel[]
  knownChats: KnownChat[]
  tgUsers: TgUserOption[]
  configured: {
    telegram: boolean
    telegramWebhookSecret: boolean
    discord: boolean
    instagram: boolean
  }
}

export const fetchSettings = () => request<SettingsResponse>('/api/posts/settings')

export const saveSettings = (settings: Partial<SocialSettings>) =>
  request<{ settings: SocialSettings }>('/api/posts/settings', 'PUT', settings)

export type ChannelInput = {
  platform?: Platform
  name?: string
  config?: ChannelConfig
  ref?: string
  defaultFooterMd?: string
  enabled?: boolean
}

export const createChannel = (channel: ChannelInput) =>
  request<{ channel: Channel }>('/api/posts/channels', 'POST', channel)

export const updateChannel = (id: string, channel: ChannelInput) =>
  request<{ channel: Channel }>(`/api/posts/channels/${id}`, 'PUT', channel)

export const deleteChannel = (id: string) =>
  request<{ result: 'deleted' | 'disabled' }>(`/api/posts/channels/${id}`, 'DELETE')

export type BotInfo = {
  username: string
  webhookUrl: string
  // Only while updates are failing to be delivered
  webhookError: string | null
  pendingUpdates: number
  lastError: { message: string; at: string } | null
}

export const fetchBotInfo = () => request<{ bot: BotInfo }>('/api/posts/telegram')
export const connectBot = () => request<{ bot: BotInfo }>('/api/posts/telegram', 'POST')

export type DiscordChannelOption = {
  id: string
  name: string
  category: string | null
  announcement: boolean
}

export const fetchDiscordChannels = () =>
  request<{ channels: DiscordChannelOption[] }>('/api/posts/discord')

export type DiscordRoleOption = { id: string; name: string; color: number }

export const fetchDiscordRoles = () =>
  request<{ roles: DiscordRoleOption[] }>('/api/posts/discord?roles')

export const testDiscordChannel = (channelId: string, crosspost: boolean) =>
  request<{ ok: boolean; problems: string[] }>('/api/posts/discord', 'POST', { channelId, crosspost })

export type InstagramAccount = {
  username: string
  accountType: string | null
  tokenExpiresAt: string | null
  tokenRefreshedAt: string | null
  lastError: string | null
}

export const fetchInstagramAccount = () =>
  request<{ account: InstagramAccount }>('/api/posts/instagram')

export const renewInstagramToken = () =>
  request<{ account: InstagramAccount }>('/api/posts/instagram', 'POST')
