// Types of scheduled posts, shared by the server and the admin UI
import type { SignupMode } from '../../types/types'

export const PLATFORMS = ['telegram', 'discord', 'instagram'] as const
export type Platform = (typeof PLATFORMS)[number]

export const PLATFORM_LABELS: Record<Platform, string> = {
  telegram: 'Telegram',
  discord: 'Discord',
  instagram: 'Instagram',
}

export const POST_STATUSES = [
  'draft',
  'awaiting_approval',
  'scheduled',
  'done',
  'cancelled',
] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  awaiting_approval: 'Awaiting approval',
  scheduled: 'Scheduled',
  done: 'Done',
  cancelled: 'Cancelled',
}

export type TargetStatus = 'pending' | 'sending' | 'sent' | 'held' | 'failed' | 'cancelled'
export type WebsiteChangeStatus =
  | 'pending'
  | 'sending'
  | 'done'
  | 'failed'
  | 'skipped'
  | 'cancelled'

// manual: the bot can't post there, so it sends the message to the review topic
// for someone to forward with "Hide sender name" (no chatId)
export type TelegramChannelConfig = { chatId: string; threadId?: string; manual?: boolean }
export type DiscordChannelConfig = { channelId: string; crosspost?: boolean }
export type ChannelConfig = Partial<TelegramChannelConfig & DiscordChannelConfig>

export type Channel = {
  id: string
  platform: Platform
  name: string
  config: ChannelConfig
  // Tag used in tracked links
  ref: string
  defaultFooterMd: string
  enabled: boolean
  deleted: boolean
}

// An uploaded image (served from /api/posts/media/:id) or an existing site image
export type PostImage = { mediaId: string; width?: number; height?: number } | { sitePath: string }

// URL of the image for showing it in the admin page
export const imagePreviewUrl = (image: PostImage) =>
  'mediaId' in image ? `/api/posts/media/${image.mediaId}` : image.sitePath

// Discord pings other than roles
export const DISCORD_PINGS = ['here', 'everyone'] as const

export type PostTarget = {
  id?: string
  channelId: string
  // Own send time (ISO); the post's sendAt when null
  sendAt: string | null
  bodyOverrideMd: string | null
  footerOverrideMd: string | null
  // Discord: who the message pings, DISCORD_PINGS or role ids
  pings: string[]
  status: TargetStatus
  externalMessageId?: string | null
  sentAt?: string | null
  error?: string | null
  attempts?: number
  // Channels forwarded by hand: who pressed "Forwarded" in the review topic
  forwardedBy?: string | null
  forwardedAt?: string | null
}

// Text of an event field: the post's text, or its own
export type TextChoice = { fromPost: true } | { text: string }

// An image of the post (by position) or an existing site image
export type ImageChoice = { postImage: number } | { sitePath: string }

export type SessionChange = {
  // Generated for new sessions when the post is saved, like the CMS preSave handler
  id: string
  name?: string
  // Helsinki wall-clock times like the event content, YYYY-MM-DDTHH:mm:ss
  start: string
  end: string
  location: string
}

// The fields of a new event, or the fields of an existing event to change.
// Fields left out are not changed.
export type EventChange = {
  name?: string
  sessions?: SessionChange[]
  signupMode?: SignupMode
  image?: ImageChoice | null
  visibleOnCalendar?: boolean
  visibleOnEventsPage?: boolean
  description?: TextChoice
  body?: TextChoice
}

export type WebsiteChangeKind = 'create_event' | 'update_event'

// When a website change runs: when the post is approved, the lead time before
// the first message, or at its own time (runAt)
export const WEBSITE_CHANGE_TIMINGS = ['on_approval', 'before_post', 'at'] as const
export type WebsiteChangeTiming = (typeof WEBSITE_CHANGE_TIMINGS)[number]

export type WebsiteChange = {
  kind: WebsiteChangeKind
  // The event to change; for a new event, the slug it gets (chosen at approval)
  eventSlug: string | null
  timing: WebsiteChangeTiming
  // When the change runs (ISO), with the timing "at"
  runAt: string | null
  event: EventChange
  status: WebsiteChangeStatus
  commitSha?: string | null
  error?: string | null
  ranAt?: string | null
}

export type PostHistoryEntry = {
  version: number
  action: string
  actor: string
  createdAt: string
}

export type Post = {
  id: string
  title: string
  bodyMd: string
  eventSlug: string | null
  status: PostStatus
  version: number
  approvedVersion: number | null
  approvedBy: string | null
  approvedAt: string | null
  sendAt: string | null
  // Sent when approved: sendAt is set to the approval time
  sendOnApproval: boolean
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  images: PostImage[]
  targets: PostTarget[]
  websiteChange: WebsiteChange | null
}

// What the editor and the MCP tools send when creating or editing a post
export type PostInput = {
  title?: string
  bodyMd?: string
  eventSlug?: string | null
  sendAt?: string | null
  sendOnApproval?: boolean
  images?: PostImage[]
  targets?: {
    channelId: string
    sendAt?: string | null
    bodyOverrideMd?: string | null
    footerOverrideMd?: string | null
    pings?: string[]
  }[]
  websiteChange?: {
    kind: WebsiteChangeKind
    eventSlug?: string | null
    // on_approval when not given, or at when runAt is given
    timing?: WebsiteChangeTiming
    runAt?: string | null
    event: EventChange
  } | null
}

export type TelegramSettings = {
  reviewChatId: string
  reviewThreadId: string
  approvers: { id: string; name: string }[]
}

export type DiscordSettings = { guildId: string }

export type WebsiteSettings = {
  // Base URL for tracked links and image URLs, e.g. https://aaltogamers.fi
  baseUrl: string
  // Default minutes between the website change and the first message
  leadMinutes: number
}

export type SocialSettings = {
  telegram: TelegramSettings
  discord: DiscordSettings
  website: WebsiteSettings
}

export const DEFAULT_SETTINGS: SocialSettings = {
  telegram: { reviewChatId: '', reviewThreadId: '', approvers: [] },
  discord: { guildId: '' },
  website: { baseUrl: 'https://aaltogamers.fi', leadMinutes: 10 },
}

// A channel's text as it will be sent
export type RenderedText = {
  channelId: string
  platform: Platform
  channelName: string
  sendAt: string | null
  // No send time yet: sent when the post is approved
  onApproval: boolean
  // Discord: names of the pinged roles by id, to show <@&id> as @name
  roleNames?: Record<string, string>
  // Telegram: HTML, Discord: markdown, Instagram: plain text
  text: string
  // Characters counted the way the platform counts them
  length: number
  limit: number
  errors: string[]
  warnings: string[]
}

// One changed field of an event, for the review and the editor
export type DiffLine = { field: string; from: string; to: string }

export type WebsiteChangePreview = {
  kind: WebsiteChangeKind
  eventSlug: string | null
  timing: WebsiteChangeTiming
  // null with the timing on_approval (until it is approved)
  runAt: string | null
  diff: DiffLine[]
  errors: string[]
  warnings: string[]
}

// What the post's {{date}}, {{signup}} etc. can refer to, for the editor's buttons
export type PlaceholderOptions = {
  // The post has an event, for {{date}}, {{time}} and {{location}}
  event: boolean
  // Sessions with sign-up forms, for {{signup:<session name>}}; empty for one form
  // for the whole event, null when the event has no sign-up
  signupSessions: string[] | null
}

export type PostPreview = {
  texts: RenderedText[]
  website: WebsiteChangePreview | null
  errors: string[]
  placeholders: PlaceholderOptions
}
