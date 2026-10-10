// Types of scheduled posts, shared by the server and the admin UI
import type { SignupInput, SignupMode, SignupPool } from '../../types/types'

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

export type TelegramChannelConfig = { chatId: string; threadId?: string }
export type DiscordChannelConfig = { channelId: string; crosspost?: boolean }
// Instagram: `linkInBio` turns links into a "link in bio" line
export type ChannelConfig = Partial<TelegramChannelConfig & DiscordChannelConfig> & { linkInBio?: boolean }

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

export type PostTarget = {
  id?: string
  channelId: string
  // Own send time (ISO); the post's sendAt when null
  sendAt: string | null
  bodyOverrideMd: string | null
  footerOverrideMd: string | null
  status: TargetStatus
  externalMessageId?: string | null
  sentAt?: string | null
  error?: string | null
  attempts?: number
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

export type SignupFormData = {
  openfrom: string
  openuntil: string
  pools: SignupPool[]
  inputs: SignupInput[]
  confirmedMessage?: string
  confirmedLink?: string
}

// A sign-up form to create or change: the event's form (no sessionId) or a session's
export type SignupFormChange = { sessionId?: string; form: SignupFormData }

export type WebsiteChangeKind = 'create_event' | 'update_event'

export type WebsiteChange = {
  kind: WebsiteChangeKind
  // The event to change; for a new event, the slug it gets (chosen at approval)
  eventSlug: string | null
  // When the change runs (ISO); earliest send time − lead time when null
  runAt: string | null
  event: EventChange
  signupForms: SignupFormChange[]
  status: WebsiteChangeStatus
  commitSha?: string | null
  error?: string | null
  ranAt?: string | null
}

export type PostHistoryEntry = {
  version: number
  action: string
  actor: string
  comment: string | null
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
  images?: PostImage[]
  targets?: {
    channelId: string
    sendAt?: string | null
    bodyOverrideMd?: string | null
    footerOverrideMd?: string | null
  }[]
  websiteChange?: {
    kind: WebsiteChangeKind
    eventSlug?: string | null
    runAt?: string | null
    event: EventChange
    signupForms?: SignupFormChange[]
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
  runAt: string | null
  diff: DiffLine[]
  forms: { key: string; label: string; isNew: boolean; signups: number }[]
  errors: string[]
  warnings: string[]
}

export type PostPreview = {
  texts: RenderedText[]
  website: WebsiteChangePreview | null
  errors: string[]
}
