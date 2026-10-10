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
import { parseFields, parsePools } from './agentEvents'
import { getSettings, type Actor } from './postStore'
import { getSignupForm } from './signupForms'
import { saveUploadedImage, MAX_UPLOAD_BYTES } from './social/media'
import type {
  Channel,
  EventChange,
  ImageChoice,
  Post,
  PostHistoryEntry,
  PostImage,
  PostInput,
  PostPreview,
  SignupFormChange,
  TextChoice,
} from './social/types'
import type { SignupPool } from '../types/types'

const toIso = (value: unknown, name: string) =>
  value === null ? null : parseAgentTime(value, name).toISOString()

const toContentTime = (value: unknown, name: string) =>
  parseAgentTime(value, name).format('YYYY-MM-DDTHH:mm:ss')

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
      if (mediaId) return { mediaId }
      if (sitePath) return { sitePath }
      if (url) return downloadImage(url, `images[${i}]`)
      throw new AgentError(400, `images[${i}] needs a url, sitePath or mediaId`)
    })
  )

const textChoice = (text: unknown, fromPost: unknown, name: string): TextChoice | undefined => {
  if (optionalBoolean(fromPost, `${name}FromPost`)) return { fromPost: true }
  if (text === undefined) return undefined
  return { text: typeof text === 'string' ? text : '' }
}

const parseEvent = (raw: unknown): EventChange => {
  const e = asRecord(raw ?? {}, 'websiteChange.event')
  const event: EventChange = {}
  if (e.name !== undefined) event.name = requireString(e.name, 'websiteChange.event.name')
  if (e.sessions !== undefined) {
    event.sessions = (optionalArray(e.sessions, 'websiteChange.event.sessions') ?? []).map((rawSession, i) => {
      const s = asRecord(rawSession, `websiteChange.event.sessions[${i}]`)
      const start = toContentTime(s.start, `websiteChange.event.sessions[${i}].start`)
      return {
        id: optionalString(s.id, `websiteChange.event.sessions[${i}].id`) ?? '',
        name: optionalString(s.name, `websiteChange.event.sessions[${i}].name`),
        start,
        end: s.end ? toContentTime(s.end, `websiteChange.event.sessions[${i}].end`) : '',
        location: requireString(s.location, `websiteChange.event.sessions[${i}].location`),
      }
    })
  }
  if (e.signupMode !== undefined) event.signupMode = e.signupMode as EventChange['signupMode']
  if (e.image !== undefined) event.image = e.image as ImageChoice | null
  if (e.visibleOnCalendar !== undefined) {
    event.visibleOnCalendar = optionalBoolean(e.visibleOnCalendar, 'visibleOnCalendar')
  }
  if (e.visibleOnEventsPage !== undefined) {
    event.visibleOnEventsPage = optionalBoolean(e.visibleOnEventsPage, 'visibleOnEventsPage')
  }
  event.description = textChoice(e.description, e.descriptionFromPost, 'description')
  event.body = textChoice(e.body, e.bodyFromPost, 'body')
  return Object.fromEntries(Object.entries(event).filter(([, v]) => v !== undefined))
}

// Private pools keep their current password unless a new one is given: the one
// in the post's website change, or the existing sign-up form's
const currentPools = async (
  existing: Post | null,
  eventSlug: string | null,
  sessionId?: string
): Promise<SignupPool[]> => {
  const inPost = existing?.websiteChange?.signupForms.find((f) => (f.sessionId ?? '') === (sessionId ?? ''))
  if (inPost) return inPost.form.pools
  if (!eventSlug) return []
  return (await getSignupForm(sessionId ? `${eventSlug}:${sessionId}` : eventSlug))?.pools ?? []
}

const parseForms = async (
  raw: unknown,
  existing: Post | null,
  eventSlug: string | null
): Promise<SignupFormChange[]> =>
  Promise.all(
    (optionalArray(raw, 'websiteChange.signupForms') ?? []).map(async (rawForm, i) => {
      const f = asRecord(rawForm, `websiteChange.signupForms[${i}]`)
      const openfrom = parseAgentTime(f.openFrom, `signupForms[${i}].openFrom`)
      const openuntil = parseAgentTime(f.openUntil, `signupForms[${i}].openUntil`)
      if (!openuntil.isAfter(openfrom)) throw new AgentError(400, `signupForms[${i}]: openUntil must be after openFrom`)
      const sessionId = optionalString(f.sessionId, `signupForms[${i}].sessionId`)
      return {
        ...(sessionId && { sessionId }),
        form: {
          openfrom: openfrom.toISOString(),
          openuntil: openuntil.toISOString(),
          pools: parsePools(f.pools, await currentPools(existing, eventSlug, sessionId)),
          inputs: parseFields(f.fields),
          confirmedMessage: optionalString(f.confirmedMessage, 'confirmedMessage') ?? '',
          confirmedLink: optionalString(f.confirmedLink, 'confirmedLink') ?? '',
        },
      }
    })
  )

// Turns the arguments of create_post / update_post into a PostInput. Only given
// fields are set. `existing` is the post being updated.
export const parsePostArgs = async (
  args: Record<string, unknown>,
  existing: Post | null = null
): Promise<PostInput> => {
  const input: PostInput = {}
  if ('title' in args) input.title = requireString(args.title, 'title')
  if ('body' in args) input.bodyMd = typeof args.body === 'string' ? args.body : ''
  if ('eventSlug' in args) input.eventSlug = optionalString(args.eventSlug, 'eventSlug') ?? null
  if ('sendAt' in args) input.sendAt = args.sendAt === null ? null : toIso(args.sendAt, 'sendAt')
  if ('images' in args) input.images = await parseImages(args.images)
  if ('channels' in args) {
    input.targets = (optionalArray(args.channels, 'channels') ?? []).map((raw, i) => {
      const t = asRecord(raw, `channels[${i}]`)
      return {
        channelId: requireString(String(t.channelId ?? ''), `channels[${i}].channelId`),
        sendAt: t.sendAt ? toIso(t.sendAt, `channels[${i}].sendAt`) : null,
        bodyOverrideMd: optionalString(t.bodyOverride, `channels[${i}].bodyOverride`) ?? null,
        footerOverrideMd: t.footerOverride === undefined || t.footerOverride === null ? null : String(t.footerOverride),
      }
    })
  }
  if ('websiteChange' in args) {
    if (args.websiteChange === null) {
      input.websiteChange = null
    } else {
      const w = asRecord(args.websiteChange, 'websiteChange')
      const kind = w.kind as 'create_event' | 'update_event'
      const eventSlug = optionalString(w.eventSlug, 'websiteChange.eventSlug') ?? null
      input.websiteChange = {
        kind,
        eventSlug,
        runAt: w.runAt ? toIso(w.runAt, 'websiteChange.runAt') : null,
        event: parseEvent(w.event),
        signupForms: await parseForms(w.signupForms, existing, kind === 'update_event' ? eventSlug : null),
      }
    }
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
  ...(c.platform === 'instagram' && { linkInBio: !!c.config.linkInBio }),
})

const describeWebsiteChange = (post: Post) => {
  const w = post.websiteChange
  if (!w) return null
  const text = (choice?: TextChoice) =>
    choice && ('fromPost' in choice ? { fromPost: true } : choice.text)
  return {
    kind: w.kind,
    eventSlug: w.eventSlug,
    runAt: time(w.runAt) ?? 'default: before the first message',
    status: w.status,
    ...(w.error && { error: w.error }),
    event: {
      ...w.event,
      sessions: w.event.sessions?.map((s) => ({ ...s, start: s.start.slice(0, 16), end: s.end.slice(0, 16) })),
      description: text(w.event.description),
      body: text(w.event.body),
    },
    signupForms: w.signupForms.map(({ sessionId, form }) => ({
      sessionId,
      openFrom: time(form.openfrom),
      openUntil: time(form.openuntil),
      pools: form.pools,
      fields: form.inputs,
      confirmedMessage: form.confirmedMessage || undefined,
      confirmedLink: form.confirmedLink || undefined,
    })),
  }
}

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
  ...(full && { body: post.bodyMd, images: post.images }),
  channels: post.targets.map((t) => {
    const channel = channels.find((c) => c.id === t.channelId)
    return {
      channelId: t.channelId,
      name: channel?.name,
      platform: channel?.platform,
      sendAt: time(t.sendAt ?? post.sendAt),
      ownSendTime: !!t.sendAt,
      status: t.status,
      ...(t.error && { error: t.error }),
      ...(full && {
        bodyOverride: t.bodyOverrideMd ?? undefined,
        footerOverride: t.footerOverrideMd ?? undefined,
      }),
    }
  }),
  websiteChange: full
    ? describeWebsiteChange(post)
    : post.websiteChange && {
        kind: post.websiteChange.kind,
        eventSlug: post.websiteChange.eventSlug,
        status: post.websiteChange.status,
      },
  ...(history && {
    history: history.map((h) => ({
      version: h.version,
      action: h.action,
      by: h.actor,
      at: formatAgentTime(h.createdAt),
      ...(h.comment && { comment: h.comment }),
    })),
  }),
})

export const describePreview = (preview: PostPreview) => ({
  errors: preview.errors,
  channels: preview.texts.map((t) => ({
    channelId: t.channelId,
    channel: t.channelName,
    platform: t.platform,
    sendAt: time(t.sendAt),
    format: t.platform === 'telegram' ? 'Telegram HTML' : t.platform === 'discord' ? 'Discord markdown' : 'plain text',
    text: t.text,
    characters: t.length,
    limit: t.limit,
    errors: t.errors,
    warnings: t.warnings,
  })),
  website: preview.website && {
    ...preview.website,
    runAt: time(preview.website.runAt),
    // Only counts of sign-ups, never their answers
    signupForms: preview.website.forms,
    forms: undefined,
  },
})

export const AGENT: Actor = 'agent'
