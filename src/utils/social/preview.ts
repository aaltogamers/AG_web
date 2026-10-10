// What a post will send: each channel's rendered text and the website change's
// diff. Shown in the admin editor, by preview_post and in the review topic.
import fs from 'fs/promises'
import path from 'path'
import { eventFromFile, getEventFile } from '../eventFiles'
import { getSignupTargets } from '../eventUtils'
import { getSettings, listChannels, targetSendAt, websiteRunAt } from '../postStore'
import { parseMarkdown } from '../fileUtils'
import { isDiscordConfigured } from './discord'
import { isInstagramConfigured } from './instagram'
import { instagramRatioProblem, siteImageSize } from './media'
import { fillPlaceholders, joinBodyAndFooter, renderForPlatform } from './render'
import { isTelegramConfigured } from './telegram'
import type { Channel, Post, PostPreview, PostTarget, RenderedText, SocialSettings } from './types'
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

// The event the post's links point to, and the sessions that have sign-ups
const resolveEventContext = async (post: Post) => {
  const change = post.websiteChange
  if (change && change.status !== 'skipped' && change.status !== 'cancelled') {
    const preview = await previewWebsiteChange(post, change, null)
    return {
      eventSlug: preview.eventSlug,
      signupSessions: preview.resolved ? signupSessionsAfterChange(preview.resolved) : null,
      website: preview,
    }
  }
  if (!post.eventSlug) return { eventSlug: null, signupSessions: null, website: null }
  const file = await getEventFile(post.eventSlug)
  if (!file) return { eventSlug: post.eventSlug, signupSessions: null, website: null }
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
    website: null,
  }
}

export const renderTarget = (
  post: Post,
  target: PostTarget,
  channel: Channel,
  settings: SocialSettings,
  eventContext: { eventSlug: string | null; signupSessions: (string | undefined)[] | null },
  linkSlugs?: string[]
): RenderedText => {
  const body = target.bodyOverrideMd ?? post.bodyMd
  const footer = target.footerOverrideMd ?? channel.defaultFooterMd
  const filled = fillPlaceholders(joinBodyAndFooter(body, footer), {
    baseUrl: settings.website.baseUrl,
    ref: channel.ref,
    eventSlug: eventContext.eventSlug,
    signupSessions: eventContext.signupSessions,
    linkSlugs,
  })
  const rendered = renderForPlatform(channel.platform, filled.text, {
    imageCount: post.images.length,
    linkInBio: !!channel.config.linkInBio,
  })
  const errors = [...filled.errors, ...rendered.errors]
  const warnings = [...rendered.warnings]
  const sendAt = targetSendAt(post, target)
  const editable = target.status !== 'sent' && target.status !== 'sending' && target.status !== 'cancelled'
  if (editable) {
    if (!sendAt) errors.push('No send time')
    if (!channel.enabled) warnings.push('The channel is disabled')
    if (!PLATFORM_READY[channel.platform]()) errors.push(`Not set up: ${PLATFORM_ENV[channel.platform]} must be set on the server`)
  }
  return {
    channelId: channel.id,
    platform: channel.platform,
    channelName: channel.name,
    sendAt,
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

  const [eventContext, linkSlugs] = await Promise.all([resolveEventContext(post), getLinkSlugs()])
  const texts = activeTargets.flatMap((target) => {
    const channel = channels.find((c) => c.id === target.channelId)
    return channel ? [renderTarget(post, target, channel, settings, eventContext, linkSlugs)] : []
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
        runAt: websiteRunAt(post, settings.website.leadMinutes),
        diff: eventContext.website.diff,
        forms: eventContext.website.forms,
        errors: eventContext.website.errors,
        warnings: eventContext.website.warnings,
      }
    : null
  if (website && !website.runAt && post.websiteChange?.status === 'pending') {
    website.errors.push('No time for the website change: give it a time or give the channels send times')
  }
  return { texts, website, errors }
}

// All problems that block approval
export const previewErrors = (preview: PostPreview) => [
  ...preview.errors,
  ...preview.texts.flatMap((t) => t.errors.map((e) => `${t.channelName} (${t.platform}): ${e}`)),
  ...(preview.website?.errors ?? []).map((e) => `Website: ${e}`),
]

