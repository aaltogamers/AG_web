// Renders a post's Markdown for each channel (Telegram HTML, Discord Markdown,
// Instagram plain text) and checks the limits. The preview and sender share it.
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes, Parents } from 'mdast'
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
}

export const PLACEHOLDER_HELP =
  '{{link:<name>}} (a https://aaltogamers.fi/link/<name> redirect, e.g. {{link:discord}}), {{event}} (the event page), {{signup}} or {{signup:<session name>}} (the sign-up form)'

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
): { text: string; errors: string[] } => {
  const errors: string[] = []
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
      errors.push(`${match}: unknown placeholder. Use ${PLACEHOLDER_HELP}`)
      return match
    }
  )
  return { text, errors }
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

// Instagram: plain text. Links aren't clickable, so they become the bare URL,
// or with `linkInBio` only their text and a "link in bio" line at the end.

const plainBlocks = (nodes: Nodes[], linkInBio: boolean, indent = ''): string =>
  nodes
    .map((node) => plainBlock(node, linkInBio, indent))
    .filter((s) => s !== '')
    .join('\n\n')

const plainBlock = (node: Nodes, linkInBio: boolean, indent: string): string => {
  switch (node.type) {
    case 'root':
      return plainBlocks(node.children, linkInBio)
    case 'paragraph':
    case 'heading':
      return plainInline(node.children, linkInBio)
    case 'blockquote':
      return plainBlocks(node.children, linkInBio)
    case 'code':
      return node.value
    case 'list':
      return node.children
        .map((item, i) => {
          const bullet = node.ordered ? `${(node.start ?? 1) + i}.` : '•'
          const [first, ...rest] = item.children
          const firstText = first ? plainBlock(first, linkInBio, `${indent}  `) : ''
          const restText = rest.map((child) => plainBlock(child, linkInBio, `${indent}  `))
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
      return plainInline([node], linkInBio)
  }
}

const plainInline = (nodes: Nodes[], linkInBio: boolean): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'inlineCode':
        case 'html':
          return node.value
        case 'break':
          return '\n'
        case 'link': {
          const text = plainInline(node.children, linkInBio)
          if (linkInBio) return text === node.url ? '' : text
          return !text || text === node.url ? node.url : `${text} ${node.url}`
        }
        case 'image':
          return linkInBio ? node.alt : node.url
        default:
          return plainInline(childrenOf(node), linkInBio)
      }
    })
    .join('')

const hasLinks = (node: Nodes): boolean =>
  node.type === 'link' || node.type === 'image' || childrenOf(node).some(hasLinks)

export const toInstagramText = (markdown: string, linkInBio = false) => {
  const tree = parse(markdown)
  const text = plainBlock(tree, linkInBio, '').trim()
  return linkInBio && hasLinks(tree) ? `${text}\n\n🔗 Link in bio` : text
}

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
  options: { imageCount: number; linkInBio?: boolean }
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
    text = toInstagramText(markdown, options.linkInBio)
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
