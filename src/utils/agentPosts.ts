// Scheduled post input and output of the AI agent MCP server (/api/mcp). The
// agent works in Helsinki times; posts store ISO times.
import {
  AgentError,
  asRecord,
  formatAgentTime,
  optionalArray,
  optionalBoolean,
  optionalString,
  parseAgentTime,
  requireString,
} from './agentApi'
import { getSettings, type Actor } from './postStore'
import { resolveAssignees } from './taskStore'
import { saveUploadedImage, MAX_UPLOAD_BYTES } from './social/media'
import type {
  Channel,
  Post,
  PostHistoryEntry,
  PostImage,
  PostInput,
  PostPerson,
  PostPreview,
} from './social/types'

const toIso = (value: unknown, name: string) =>
  value === null ? null : parseAgentTime(value, name).toISOString()

// Images from a URL are downloaded and stored like uploads
const downloadImage = async (url: string, name: string): Promise<PostImage> => {
  if (!/^https?:\/\//i.test(url)) throw new AgentError(400, `${name}.url must start with https://`)
  const res = await fetch(url).catch(() => null)
  if (!res?.ok) throw new AgentError(400, `${name}: could not download ${url}`)
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length > MAX_UPLOAD_BYTES) throw new AgentError(400, `${name}: the image is larger than 15 MB`)
  return saveUploadedImage(data)
}

const parseImages = async (raw: unknown): Promise<PostImage[]> =>
  Promise.all(
    (optionalArray(raw, 'images') ?? []).map(async (item, i) => {
      const image = asRecord(item, `images[${i}]`)
      const mediaId = optionalString(image.mediaId, `images[${i}].mediaId`)
      const sitePath = optionalString(image.sitePath, `images[${i}].sitePath`)
      const url = optionalString(image.url, `images[${i}].url`)
      if (optionalBoolean(image.eventImage, `images[${i}].eventImage`)) return { eventImage: true as const }
      if (mediaId) return { mediaId }
      if (sitePath) return { sitePath }
      if (url) return downloadImage(url, `images[${i}]`)
      throw new AgentError(400, `images[${i}] needs a url, sitePath, mediaId or eventImage`)
    })
  )

// A Telegram user id from find_task_users as the user's id and name
const parsePerson = async (raw: unknown, name: string): Promise<PostPerson | null> => {
  const id = optionalString(raw, name)
  if (!id) return null
  const { assignees } = await resolveAssignees([id])
  if (!assignees.length) throw new AgentError(400, `${name}: no Telegram user with id "${id}"; see find_task_users`)
  return { id, name: assignees[0].tgUserName }
}

// Turns the arguments of create_post / update_post into a PostInput. Only given
// fields are set.
export const parsePostArgs = async (args: Record<string, unknown>): Promise<PostInput> => {
  const input: PostInput = {}
  if ('title' in args) input.title = requireString(args.title, 'title')
  if ('body' in args) input.bodyMd = typeof args.body === 'string' ? args.body : ''
  if ('eventSlug' in args) input.eventSlug = optionalString(args.eventSlug, 'eventSlug') ?? null
  if ('sendAt' in args) input.sendAt = args.sendAt === null ? null : toIso(args.sendAt, 'sendAt')
  if ('sendOnApproval' in args) input.sendOnApproval = optionalBoolean(args.sendOnApproval, 'sendOnApproval')
  if ('images' in args) input.images = await parseImages(args.images)
  if ('responsible' in args) input.responsible = await parsePerson(args.responsible, 'responsible')
  if ('shouldHaveImage' in args) input.shouldHaveImage = optionalBoolean(args.shouldHaveImage, 'shouldHaveImage')
  if ('imageResponsible' in args) {
    input.imageResponsible = await parsePerson(args.imageResponsible, 'imageResponsible')
  }
  if ('channels' in args) {
    input.targets = (optionalArray(args.channels, 'channels') ?? []).map((raw, i) => {
      const t = asRecord(raw, `channels[${i}]`)
      return {
        channelId: requireString(String(t.channelId ?? ''), `channels[${i}].channelId`),
        sendAt: t.sendAt ? toIso(t.sendAt, `channels[${i}].sendAt`) : null,
        bodyOverrideMd: optionalString(t.bodyOverride, `channels[${i}].bodyOverride`) ?? null,
        footerOverrideMd: t.footerOverride === undefined || t.footerOverride === null ? null : String(t.footerOverride),
        ...(t.pings !== undefined && t.pings !== null && { pings: optionalArray(t.pings, `channels[${i}].pings`)?.map(String) }),
      }
    })
  }
  return input
}

export const postUrl = async (postId: string) =>
  `${(await getSettings()).website.baseUrl}/admin/posts?id=${postId}`

const time = (iso: string | null | undefined) => (iso ? formatAgentTime(iso) : null)

export const describeChannel = (c: Channel) => ({
  id: c.id,
  platform: c.platform,
  name: c.name,
  ref: c.ref,
  defaultFooter: c.defaultFooterMd || undefined,
  // The bot sends it to the review topic for a human to forward
  ...(c.config.manual && { forwardedByHand: true }),
})

export const describePost = async (
  post: Post,
  channels: Channel[],
  { full = false, history }: { full?: boolean; history?: PostHistoryEntry[] } = {}
) => ({
  id: post.id,
  url: await postUrl(post.id),
  title: post.title,
  status: post.status,
  version: post.version,
  approved: post.approvedVersion === post.version && post.status !== 'draft',
  eventSlug: post.eventSlug,
  sendAt: time(post.sendAt),
  sendOnApproval: post.sendOnApproval,
  ...(full && { body: post.bodyMd, images: post.images }),
  responsible: post.responsible,
  shouldHaveImage: post.shouldHaveImage,
  imageResponsible: post.imageResponsible,
  channels: post.targets.map((t) => {
    const channel = channels.find((c) => c.id === t.channelId)
    return {
      channelId: t.channelId,
      name: channel?.name,
      platform: channel?.platform,
      sendAt: time(t.sendAt ?? post.sendAt),
      ownSendTime: !!t.sendAt,
      ...(channel?.platform === 'discord' && { pings: t.pings }),
      status: t.status,
      ...(channel?.config.manual && t.status === 'sent' && { forwarded: !!t.forwardedAt }),
      ...(t.error && { error: t.error }),
      ...(full && {
        bodyOverride: t.bodyOverrideMd ?? undefined,
        footerOverride: t.footerOverrideMd ?? undefined,
      }),
    }
  }),
  ...(history && {
    history: history.map((h) => ({
      version: h.version,
      action: h.action,
      by: h.actor,
      at: formatAgentTime(h.createdAt),
    })),
  }),
})

// A sent post as an example of how posts are written: its text and where and when it went
export const describeExamplePost = (post: Post, channels: Channel[]) => ({
  id: post.id,
  title: post.title,
  eventSlug: post.eventSlug,
  body: post.bodyMd,
  images: post.images.length,
  channels: post.targets
    .filter((t) => t.status === 'sent')
    .map((t) => {
      const channel = channels.find((c) => c.id === t.channelId)
      return {
        channelId: t.channelId,
        name: channel?.name,
        platform: channel?.platform,
        sentAt: time(t.sentAt),
        ...(channel?.platform === 'discord' && { pings: t.pings }),
        bodyOverride: t.bodyOverrideMd ?? undefined,
        footerOverride: t.footerOverrideMd ?? undefined,
      }
    }),
})

export const describePreview = (preview: PostPreview) => ({
  errors: preview.errors,
  channels: preview.texts.map((t) => ({
    channelId: t.channelId,
    channel: t.channelName,
    platform: t.platform,
    sendAt: t.onApproval ? 'when approved' : time(t.sendAt),
    format: t.platform === 'telegram' ? 'Telegram HTML' : t.platform === 'discord' ? 'Discord markdown' : 'plain text',
    text: t.text,
    characters: t.length,
    limit: t.limit,
    errors: t.errors,
    warnings: t.warnings,
  }))
})

export const AGENT: Actor = 'agent'
