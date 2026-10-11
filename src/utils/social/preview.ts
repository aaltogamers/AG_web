// What a post will send: each channel's rendered text and the website change's
// diff. Shown in the admin editor, by preview_post and in the review topic.
import fs from 'fs/promises'
import path from 'path'
import { eventFromFile, getEventFile } from '../eventFiles'
import { eventMoment, getSignupTargets } from '../eventUtils'
import { getSettings, listChannels, targetSendAt, websiteRunAt } from '../postStore'
import { parseMarkdown } from '../fileUtils'
import { getSignupForm } from '../signupForms'
import type { AGEvent } from '../../types/types'
import { isDiscordConfigured, listGuildRoles, type DiscordRole } from './discord'
import { isInstagramConfigured } from './instagram'
import { instagramRatioProblem, siteImageSize } from './media'
import {
  discordPingLine,
  escapeDiscordPings,
  fillPlaceholders,
  joinBodyAndFooter,
  renderForPlatform,
  type PlaceholderSession,
} from './render'
import { isTelegramConfigured } from './telegram'
import type { Channel, Post, PostPreview, PostTarget, RenderedText, SignupFormChange, SocialSettings } from './types'
import { previewWebsiteChange, signupSessionsAfterChange } from './website'

let linkSlugsCache: string[] | null = null

// Slugs of the /link/<slug> redirects in public/redirects.md
const getLinkSlugs = async (): Promise<string[] | undefined> => {
  if (linkSlugsCache) return linkSlugsCache
  const text = await fs.readFile(path.join(process.cwd(), 'public', 'redirects.md'), 'utf8').catch(() => null)
  if (!text) return undefined
  const { redirects } = parseMarkdown(text).data as { redirects?: { slug: string }[] }
  linkSlugsCache = (redirects ?? []).map((r) => r.slug)
  return linkSlugsCache
}

const PLATFORM_READY = {
  telegram: isTelegramConfigured,
  discord: isDiscordConfigured,
  instagram: isInstagramConfigured,
}

const PLATFORM_ENV = {
  telegram: 'TELEGRAM_POSTS_BOT_TOKEN',
  discord: 'DISCORD_BOT_TOKEN',
  instagram: 'INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN',
}

export type PreviewContext = { channels: Channel[]; settings: SocialSettings }

export const loadPreviewContext = async (): Promise<PreviewContext> => {
  const [channels, settings] = await Promise.all([listChannels(), getSettings()])
  return { channels, settings }
}

// The event's sessions with when their sign-up opens: from the website change's
// forms, or the saved forms (`savedForms`: the event exists)
const placeholderSessions = async (
  event: AGEvent,
  formChanges: SignupFormChange[],
  savedForms: boolean
): Promise<PlaceholderSession[]> => {
  const targets = getSignupTargets(event)
  return Promise.all(
    event.sessions.map(async (session) => {
      const target = event.signupMode === 'event' ? targets[0] : targets.find((t) => t.session === session)
      const changed = target && formChanges.find((f) => (f.sessionId ?? '') === (target.session?.id ?? ''))
      const signupOpens = changed
        ? changed.form.openfrom
        : target && savedForms
          ? ((await getSignupForm(target.key))?.openfrom ?? null)
          : null
      return {
        label: session.name || eventMoment(session.start).format('D.M.YYYY'),
        start: session.start,
        location: session.location,
        signupOpens,
      }
    })
  )
}

type EventContext = {
  eventSlug: string | null
  signupSessions: (string | undefined)[] | null
  sessions: PlaceholderSession[] | null
}

// The event the post's links point to, the sessions that have sign-ups, and the
// sessions for {{date}} etc.
const resolveEventContext = async (
  post: Post
): Promise<EventContext & { website: Awaited<ReturnType<typeof previewWebsiteChange>> | null }> => {
  const change = post.websiteChange
  if (change && change.status !== 'skipped' && change.status !== 'cancelled') {
    const preview = await previewWebsiteChange(post, change, null)
    const { resolved } = preview
    const event =
      resolved && eventFromFile({ slug: preview.eventSlug ?? '', data: resolved.data, body: resolved.body, sha: '' })
    return {
      eventSlug: preview.eventSlug,
      signupSessions: resolved ? signupSessionsAfterChange(resolved) : null,
      sessions: event
        ? await placeholderSessions(event, change.signupForms, change.kind === 'update_event' || change.status === 'done')
        : null,
      website: preview,
    }
  }
  if (!post.eventSlug) return { eventSlug: null, signupSessions: null, sessions: null, website: null }
  const file = await getEventFile(post.eventSlug)
  if (!file) return { eventSlug: post.eventSlug, signupSessions: null, sessions: null, website: null }
  const event = eventFromFile(file)
  const targets = getSignupTargets(event)
  return {
    eventSlug: post.eventSlug,
    signupSessions:
      event.signupMode === 'none'
        ? null
        : event.signupMode === 'event'
          ? []
          : targets.map((t) => t.session?.name || t.session?.start.slice(0, 10)),
    sessions: await placeholderSessions(event, [], true),
    website: null,
  }
}

// The Discord roles, for checking pings and showing them by name; null when they can't be loaded
const loadDiscordRoles = async (post: Post, channels: Channel[], settings: SocialSettings) => {
  const pingsRoles = post.targets.some(
    (t) =>
      t.pings.some((p) => /^\d+$/.test(p)) && channels.find((c) => c.id === t.channelId)?.platform === 'discord'
  )
  if (!pingsRoles || !settings.discord.guildId || !isDiscordConfigured()) return null
  return listGuildRoles(settings.discord.guildId).catch(() => null)
}

export const renderTarget = (
  post: Post,
  target: PostTarget,
  channel: Channel,
  settings: SocialSettings,
  eventContext: EventContext,
  linkSlugs?: string[],
  // null when they couldn't be loaded
  discordRoles: DiscordRole[] | null = null
): RenderedText => {
  const body = target.bodyOverrideMd ?? post.bodyMd
  const footer = target.footerOverrideMd ?? channel.defaultFooterMd
  const sendAt = targetSendAt(post, target)
  const onApproval = !sendAt && post.sendOnApproval
  const filled = fillPlaceholders(joinBodyAndFooter(body, footer), {
    baseUrl: settings.website.baseUrl,
    ref: channel.ref,
    eventSlug: eventContext.eventSlug,
    signupSessions: eventContext.signupSessions,
    linkSlugs,
    sessions: eventContext.sessions,
    // Sent when approved: about now
    sendAt: sendAt ?? (onApproval ? new Date().toISOString() : null),
  })
  const isDiscord = channel.platform === 'discord'
  const pings = isDiscord ? target.pings : []
  const markdown = isDiscord
    ? joinBodyAndFooter(discordPingLine(pings), escapeDiscordPings(filled.text))
    : filled.text
  const rendered = renderForPlatform(channel.platform, markdown, { imageCount: post.images.length })
  const errors = [...filled.errors, ...rendered.errors]
  const warnings = [...filled.warnings, ...rendered.warnings]
  const roleIds = pings.filter((p) => /^\d+$/.test(p))
  const roleNames = Object.fromEntries(
    (discordRoles ?? []).filter((r) => roleIds.includes(r.id)).map((r) => [r.id, r.name])
  )
  const editable = target.status !== 'sent' && target.status !== 'sending' && target.status !== 'cancelled'
  if (editable) {
    if (!sendAt && !onApproval) errors.push('No send time')
    if (discordRoles) {
      roleIds.filter((id) => !roleNames[id]).forEach((id) => errors.push(`Pinged role ${id} no longer exists`))
    }
    // Disabled and deleted channels get nothing; remove them from the post
    if (!channel.enabled) errors.push(`The channel is ${channel.deleted ? 'deleted' : 'disabled'}`)
    if (!PLATFORM_READY[channel.platform]()) errors.push(`Not set up: ${PLATFORM_ENV[channel.platform]} must be set on the server`)
  }
  return {
    channelId: channel.id,
    platform: channel.platform,
    channelName: channel.name,
    sendAt,
    onApproval,
    ...(isDiscord && { roleNames }),
    text: rendered.text,
    length: rendered.length,
    limit: rendered.limit,
    errors,
    warnings,
  }
}

export const buildPreview = async (post: Post, ctx?: PreviewContext): Promise<PostPreview> => {
  const { channels, settings } = ctx ?? (await loadPreviewContext())
  const errors: string[] = []
  const activeTargets = post.targets.filter((t) => t.status !== 'cancelled')
  if (!activeTargets.length && !post.websiteChange) {
    errors.push('A post needs at least one channel or a website change')
  }

  const [eventContext, linkSlugs, discordRoles] = await Promise.all([
    resolveEventContext(post),
    getLinkSlugs(),
    loadDiscordRoles(post, channels, settings),
  ])
  const texts = activeTargets.flatMap((target) => {
    const channel = channels.find((c) => c.id === target.channelId)
    return channel ? [renderTarget(post, target, channel, settings, eventContext, linkSlugs, discordRoles)] : []
  })

  // Instagram needs images between 4:5 and 1.91:1
  const instagram = texts.filter((t) => t.platform === 'instagram')
  if (instagram.length) {
    for (const [i, image] of post.images.entries()) {
      const size =
        'mediaId' in image
          ? { width: image.width ?? 0, height: image.height ?? 0 }
          : await siteImageSize(image.sitePath).catch(() => ({ width: 0, height: 0 }))
      const problem = instagramRatioProblem(size.width, size.height)
      if (problem) instagram.forEach((t) => t.errors.push(`Image ${i + 1} is ${problem}, which Instagram doesn't accept`))
    }
  }

  const website = eventContext.website
    ? {
        kind: eventContext.website.kind,
        eventSlug: eventContext.website.eventSlug,
        timing: post.websiteChange?.timing ?? 'on_approval',
        runAt: websiteRunAt(post, settings.website.leadMinutes),
        diff: eventContext.website.diff,
        forms: eventContext.website.forms,
        errors: eventContext.website.errors,
        warnings: eventContext.website.warnings,
      }
    : null
  if (website && website.timing !== 'on_approval' && !website.runAt && post.websiteChange?.status === 'pending') {
    website.errors.push('No time for the website change: give it a time or give the channels send times')
  }
  const placeholders = {
    event: !!eventContext.sessions?.length,
    signupSessions: eventContext.signupSessions?.filter((s): s is string => !!s) ?? null,
  }
  return { texts, website, errors, placeholders }
}

// All problems that block approval
export const previewErrors = (preview: PostPreview) => [
  ...preview.errors,
  ...preview.texts.flatMap((t) => t.errors.map((e) => `${t.channelName} (${t.platform}): ${e}`)),
  ...(preview.website?.errors ?? []).map((e) => `Website: ${e}`),
]

