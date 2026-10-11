// Renders a post's Markdown for each channel (Telegram HTML, Discord Markdown,
// Instagram plain text) and checks the limits. The preview and sender share it.
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes, Parents } from 'mdast'
import moment, { type Moment } from 'moment-timezone'
import { EVENT_TIMEZONE, eventMoment } from '../eventUtils'
import type { Platform } from './types'

export const LIMITS: Record<Platform, number> = {
  telegram: 4096,
  discord: 2000,
  instagram: 2200,
}
export const TELEGRAM_CAPTION_LIMIT = 1024
export const INSTAGRAM_MAX_HASHTAGS = 30
export const INSTAGRAM_MAX_IMAGES = 10
export const MAX_IMAGES = 10

// A session of the post's event, for {{date}}, {{time}}, {{location}} and {{signupOpens}}
export type PlaceholderSession = {
  // The session's name, or its date (D.M.YYYY) when it has none
  label: string
  // Helsinki wall-clock time like the event content
  start: string
  location: string
  // When its sign-up opens (ISO); null when it has no sign-up form
  signupOpens: string | null
}

export type PlaceholderContext = {
  baseUrl: string
  // Tag of the channel, added to tracked links as ?ref=
  ref: string
  eventSlug: string | null
  // Names of the event's sessions that have sign-up forms; empty for one form for
  // the whole event, null when the event has no sign-up
  signupSessions: (string | undefined)[] | null
  // Slugs of the /link/<slug> redirects, to catch typos
  linkSlugs?: string[]
  // The event's sessions, sorted by start; null when the post has no event
  sessions?: PlaceholderSession[] | null
  // When the message is sent (ISO), for "today" and "tomorrow"; null when not known
  sendAt?: string | null
}

export const PLACEHOLDER_HELP =
  '{{link:<name>}} (a https://aaltogamers.fi/link/<name> redirect, e.g. {{link:discord}}), {{event}} (the event page), {{signup}} or {{signup:<session name>}} (the sign-up form), {{date}} (e.g. "Friday, September 18th", or "today" / "tomorrow" when sent that day / the day before), {{time}} (e.g. 17:00), {{location}}, {{signupOpens}} (when sign-up opens, e.g. "today at 16:00"). {{date}}, {{time}}, {{location}} and {{signupOpens}} are of the next session at the send time, or {{date:<session name>}} etc.'

const SESSION_PLACEHOLDERS = ['date', 'time', 'location', 'signupopens']

// A day relative to the send time: "today", "tomorrow" or e.g. "Friday, September 18th"
const formatDay = (time: Moment, sendAt: string | null | undefined) => {
  if (sendAt) {
    const sent = moment(sendAt).tz(EVENT_TIMEZONE)
    const days = time.clone().startOf('day').diff(sent.clone().startOf('day'), 'days')
    if (days === 0) return 'today'
    if (days === 1) return 'tomorrow'
  }
  return time.format('dddd, MMMM Do')
}

// The session a {{date}} etc. is about: the named one, or the next one at the send time
const pickSession = (sessions: PlaceholderSession[], name: string | undefined, sendAt: string | null | undefined) => {
  if (name) return sessions.find((s) => s.label.toLowerCase() === name.toLowerCase()) ?? null
  const from = sendAt ? moment(sendAt) : moment()
  return sessions.find((s) => eventMoment(s.start).isSameOrAfter(from)) ?? sessions[sessions.length - 1] ?? null
}

const withRef = (url: string, ref: string) => {
  if (!ref) return url
  const [beforeHash, hash] = url.split('#')
  const sep = beforeHash.includes('?') ? '&' : '?'
  return `${beforeHash}${sep}ref=${encodeURIComponent(ref)}${hash !== undefined ? `#${hash}` : ''}`
}

// Fills in {{link:name}}, {{event}} and {{signup}}. Unknown or unusable
// placeholders are left as they are and reported.
export const fillPlaceholders = (
  markdown: string,
  ctx: PlaceholderContext
): { text: string; errors: string[]; warnings: string[] } => {
  const errors: string[] = []
  const warnings: string[] = []
  const base = ctx.baseUrl.replace(/\/+$/, '')
  const text = markdown.replace(
    /\{\{\s*([a-zA-Z]+)\s*(?::\s*([^}]*?)\s*)?\}\}/g,
    (match, rawName: string, arg?: string) => {
      const name = rawName.toLowerCase()
      if (name === 'link') {
        if (!arg) {
          errors.push(`${match}: give the link's name, e.g. {{link:discord}}`)
          return match
        }
        if (ctx.linkSlugs && !ctx.linkSlugs.includes(arg)) {
          errors.push(`${match}: there is no /link/${arg} redirect`)
          return match
        }
        return withRef(`${base}/link/${encodeURIComponent(arg)}`, ctx.ref)
      }
      if (name === 'event' || name === 'signup') {
        if (!ctx.eventSlug) {
          errors.push(`${match}: the post has no event`)
          return match
        }
        const eventUrl = `${base}/events/${ctx.eventSlug}`
        if (name === 'event') return withRef(eventUrl, ctx.ref)
        if (!ctx.signupSessions) {
          errors.push(`${match}: the event has no sign-up`)
          return match
        }
        if (arg) {
          const names = ctx.signupSessions.filter((s): s is string => !!s)
          if (!names.some((s) => s.toLowerCase() === arg.toLowerCase())) {
            errors.push(
              `${match}: no session called "${arg}" has a sign-up${names.length ? ` (sessions: ${names.join(', ')})` : ''}`
            )
            return match
          }
        } else if (ctx.signupSessions.length > 1) {
          errors.push(`${match}: the event has several sign-ups, pick one with {{signup:<session name>}}`)
        }
        return withRef(`${eventUrl}#signups`, ctx.ref)
      }
      if (SESSION_PLACEHOLDERS.includes(name)) {
        if (!ctx.eventSlug || !ctx.sessions) {
          errors.push(`${match}: the post has no event`)
          return match
        }
        if (!ctx.sessions.length) {
          errors.push(`${match}: the event has no sessions`)
          return match
        }
        const session = pickSession(ctx.sessions, arg, ctx.sendAt)
        if (!session) {
          errors.push(`${match}: no session called "${arg}" (sessions: ${ctx.sessions.map((s) => s.label).join(', ')})`)
          return match
        }
        const start = eventMoment(session.start)
        if (name === 'date') return formatDay(start, ctx.sendAt)
        if (name === 'time') return start.format('HH:mm')
        if (name === 'location') return session.location
        if (!session.signupOpens) {
          errors.push(`${match}: ${ctx.sessions.length > 1 ? `the session ${session.label}` : 'the event'} has no sign-up form`)
          return match
        }
        const opens = moment(session.signupOpens).tz(EVENT_TIMEZONE)
        if (ctx.sendAt && opens.isSameOrBefore(ctx.sendAt)) warnings.push(`${match}: sign-up is already open when this is sent`)
        return `${formatDay(opens, ctx.sendAt)} at ${opens.format('HH:mm')}`
      }
      errors.push(`${match}: unknown placeholder. Use ${PLACEHOLDER_HELP}`)
      return match
    }
  )
  return { text, errors, warnings }
}

// Body and footer, separated by an empty line
export const joinBodyAndFooter = (body: string, footer: string) =>
  [body.trim(), footer.trim()].filter(Boolean).join('\n\n')

const parse = (markdown: string) => fromMarkdown(markdown)

const childrenOf = (node: Nodes): Nodes[] => ('children' in node ? (node as Parents).children : [])

// Telegram: escaped HTML with only b i u s a code pre blockquote

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

const telegramBlocks = (nodes: Nodes[], indent = ''): string =>
  nodes
    .map((node) => telegramBlock(node, indent))
    .filter((s) => s !== '')
    .join('\n\n')

const telegramBlock = (node: Nodes, indent: string): string => {
  switch (node.type) {
    case 'root':
      return telegramBlocks(node.children)
    case 'paragraph':
      return telegramInline(node.children)
    case 'heading':
      return `<b>${telegramInline(node.children)}</b>`
    case 'blockquote':
      return `<blockquote>${telegramBlocks(node.children)}</blockquote>`
    case 'code':
      return `<pre>${escapeHtml(node.value)}</pre>`
    case 'list':
      return node.children
        .map((item, i) => {
          const bullet = node.ordered ? `${(node.start ?? 1) + i}.` : '•'
          const [first, ...rest] = item.children
          const firstText = first ? telegramBlock(first, `${indent}  `) : ''
          const restText = rest.map((child) => telegramBlock(child, `${indent}  `))
          return [`${indent}${bullet} ${firstText}`, ...restText].join('\n')
        })
        .join('\n')
    case 'thematicBreak':
      return '———'
    case 'html':
      return escapeHtml(node.value)
    case 'definition':
      return ''
    default:
      return telegramInline([node])
  }
}

const telegramInline = (nodes: Nodes[]): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return escapeHtml(node.value)
        case 'strong':
          return `<b>${telegramInline(node.children)}</b>`
        case 'emphasis':
          return `<i>${telegramInline(node.children)}</i>`
        case 'delete':
          return `<s>${telegramInline(node.children)}</s>`
        case 'inlineCode':
          return `<code>${escapeHtml(node.value)}</code>`
        case 'break':
          return '\n'
        case 'link':
          return `<a href="${escapeAttr(node.url)}">${telegramInline(node.children) || escapeHtml(node.url)}</a>`
        case 'image':
          return `<a href="${escapeAttr(node.url)}">${escapeHtml(node.alt || node.url)}</a>`
        case 'html':
          return escapeHtml(node.value)
        default:
          return telegramInline(childrenOf(node))
      }
    })
    .join('')

export const toTelegramHtml = (markdown: string) => telegramBlock(parse(markdown), '').trim()

// Length of Telegram HTML as Telegram counts it: the visible text
export const telegramLength = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&').length

// Discord: Markdown, mostly unchanged. Images become links.

const discordBlocks = (nodes: Nodes[], indent = ''): string =>
  nodes
    .map((node) => discordBlock(node, indent))
    .filter((s) => s !== '')
    .join('\n\n')

const discordBlock = (node: Nodes, indent: string): string => {
  switch (node.type) {
    case 'root':
      return discordBlocks(node.children)
    case 'paragraph':
      return discordInline(node.children)
    case 'heading':
      // Discord has three heading levels
      return `${'#'.repeat(Math.min(node.depth, 3))} ${discordInline(node.children)}`
    case 'blockquote':
      return discordBlocks(node.children)
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
    case 'code':
      return `\`\`\`${node.lang ?? ''}\n${node.value}\n\`\`\``
    case 'list':
      return node.children
        .map((item, i) => {
          const bullet = node.ordered ? `${(node.start ?? 1) + i}.` : '-'
          const [first, ...rest] = item.children
          const firstText = first ? discordBlock(first, `${indent}  `) : ''
          const restText = rest.map((child) => discordBlock(child, `${indent}  `))
          return [`${indent}${bullet} ${firstText}`, ...restText].join('\n')
        })
        .join('\n')
    case 'thematicBreak':
      return '———'
    case 'html':
      return node.value
    case 'definition':
      return ''
    default:
      return discordInline([node])
  }
}

const discordInline = (nodes: Nodes[]): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.value
        case 'strong':
          return `**${discordInline(node.children)}**`
        case 'emphasis':
          return `*${discordInline(node.children)}*`
        case 'delete':
          return `~~${discordInline(node.children)}~~`
        case 'inlineCode':
          return `\`${node.value}\``
        case 'break':
          return '\n'
        case 'link': {
          const text = discordInline(node.children)
          return !text || text === node.url ? node.url : `[${text}](${node.url})`
        }
        case 'image':
          return node.alt ? `[${node.alt}](${node.url})` : node.url
        case 'html':
          return node.value
        default:
          return discordInline(childrenOf(node))
      }
    })
    .join('')

export const toDiscordMarkdown = (markdown: string) => discordBlock(parse(markdown), '').trim()

// Pings only come from the message's pings: @everyone and @here in the text are
// broken with a zero-width space
export const escapeDiscordPings = (markdown: string) => markdown.replace(/@(everyone|here)\b/g, '@\u200b$1')

export const discordPingLine = (pings: string[]) =>
  pings.map((p) => (p === 'here' || p === 'everyone' ? `@${p}` : `<@&${p}>`)).join(' ')

// Role mentions as @name, for showing the text in the admin page and the review
export const showDiscordRoles = (text: string, roleNames: Record<string, string> = {}) =>
  text.replace(/<@&(\d+)>/g, (match, id: string) => (roleNames[id] ? `@${roleNames[id]}` : match))

// Instagram: plain text. Links aren't clickable, so only their text is kept
// (the URL when they have no text).

const plainBlocks = (nodes: Nodes[], indent = ''): string =>
  nodes
    .map((node) => plainBlock(node, indent))
    .filter((s) => s !== '')
    .join('\n\n')

const plainBlock = (node: Nodes, indent: string): string => {
  switch (node.type) {
    case 'root':
      return plainBlocks(node.children)
    case 'paragraph':
    case 'heading':
      return plainInline(node.children)
    case 'blockquote':
      return plainBlocks(node.children)
    case 'code':
      return node.value
    case 'list':
      return node.children
        .map((item, i) => {
          const bullet = node.ordered ? `${(node.start ?? 1) + i}.` : '•'
          const [first, ...rest] = item.children
          const firstText = first ? plainBlock(first, `${indent}  `) : ''
          const restText = rest.map((child) => plainBlock(child, `${indent}  `))
          return [`${indent}${bullet} ${firstText}`, ...restText].join('\n')
        })
        .join('\n')
    case 'thematicBreak':
      return '———'
    case 'html':
      return node.value
    case 'definition':
      return ''
    default:
      return plainInline([node])
  }
}

const plainInline = (nodes: Nodes[]): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'inlineCode':
        case 'html':
          return node.value
        case 'break':
          return '\n'
        case 'link':
          return plainInline(node.children) || node.url
        case 'image':
          return node.alt || node.url
        default:
          return plainInline(childrenOf(node))
      }
    })
    .join('')

export const toInstagramText = (markdown: string) => plainBlock(parse(markdown), '').trim()

export const countHashtags = (text: string) => (text.match(/(^|\s)#[^\s#.,!?;:()]+/g) ?? []).length

export type PlatformRender = {
  text: string
  length: number
  limit: number
  errors: string[]
  warnings: string[]
}

// Renders filled-in Markdown for a platform and checks its limits
export const renderForPlatform = (
  platform: Platform,
  markdown: string,
  options: { imageCount: number }
): PlatformRender => {
  const errors: string[] = []
  const warnings: string[] = []
  const { imageCount } = options
  let text: string
  let length: number
  let limit = LIMITS[platform]

  if (platform === 'telegram') {
    text = toTelegramHtml(markdown)
    length = telegramLength(text)
    // With images, the text is their caption, which bots can only make this long
    if (imageCount > 0) limit = TELEGRAM_CAPTION_LIMIT
  } else if (platform === 'discord') {
    text = toDiscordMarkdown(markdown)
    length = text.length
  } else {
    text = toInstagramText(markdown)
    length = text.length
    limit = LIMITS.instagram
    const hashtags = countHashtags(text)
    if (hashtags > INSTAGRAM_MAX_HASHTAGS) {
      errors.push(`${hashtags} hashtags, Instagram allows ${INSTAGRAM_MAX_HASHTAGS}`)
    }
    if (imageCount === 0) errors.push('Instagram posts need at least one image')
    if (imageCount > INSTAGRAM_MAX_IMAGES) {
      errors.push(`${imageCount} images, Instagram allows ${INSTAGRAM_MAX_IMAGES}`)
    }
  }

  if (!text.trim() && imageCount === 0) errors.push('Nothing to send: no text or images')
  if (length > limit) {
    errors.push(
      `${length} characters, the limit is ${limit}${platform === 'telegram' && imageCount > 0 ? ' for a Telegram post with images' : ''}`
    )
  }
  return { text, length, limit, errors, warnings }
}
