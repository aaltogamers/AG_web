// Links in sent posts, which get the channel's ref (?ref=<channel ref>), shown with
// their visitor stats on the "Links & QR" admin page like tagged links
import { getEvents } from '../eventStore'
import { listChannels, listSentPosts, getSettings } from '../postStore'
import { getRedirects } from '../redirects'
import { TaggedLinkStats, statsPath, withTag } from '../taggedLinks'
import { getTagStats } from '../umami'
import { joinBodyAndFooter, placeholderLinks } from './render'

export type PostLink = {
  // The link, e.g. an event's name
  label: string
  name: string
  url: string
  tag: string
  taggedUrl: string
  channelName: string
  lastSentAt: string
  postCount: number
}

export type PostLinkWithStats = PostLink & { stats: TaggedLinkStats | null }

const SENT_POSTS = 300

export const listPostLinks = async (): Promise<PostLink[]> => {
  const [posts, channels, settings, events] = await Promise.all([
    listSentPosts(SENT_POSTS),
    listChannels(),
    getSettings(),
    getEvents(),
  ])
  const eventNames = new Map(events.map((e) => [e.slug, e.name]))
  const redirectNames = new Map(getRedirects().map((r) => [r.slug, r.name]))

  const label = (url: string) => {
    const path = new URL(url).pathname
    const link = path.match(/^\/link\/([^/]+)$/)?.[1]
    if (link) return redirectNames.get(decodeURIComponent(link)) ?? decodeURIComponent(link)
    const event = path.match(/^\/events\/([^/]+)$/)?.[1]
    if (event) return eventNames.get(event) ?? event
    return path
  }

  // The event page and its sign-up have the same stats, so they are one link
  const links = new Map<string, PostLink & { posts: Set<string> }>()
  for (const post of posts) {
    for (const target of post.targets) {
      const channel = channels.find((c) => c.id === target.channelId)
      if (target.status !== 'sent' || !target.sentAt || !channel?.ref) continue
      const markdown = joinBodyAndFooter(
        target.bodyOverrideMd ?? post.bodyMd,
        target.footerOverrideMd ?? channel.defaultFooterMd
      )
      for (const url of placeholderLinks(markdown, settings.website.baseUrl, post.eventSlug)) {
        const plain = url.replace(/\?signup$/, '')
        const key = `${statsPath(plain) ?? plain}|${channel.ref}`
        const existing = links.get(key)
        if (existing) {
          existing.posts.add(post.id)
          if (target.sentAt > existing.lastSentAt) existing.lastSentAt = target.sentAt
          continue
        }
        links.set(key, {
          label: label(plain),
          name: `${label(plain)} – ${channel.name}`,
          url: plain,
          tag: channel.ref,
          taggedUrl: withTag(plain, channel.ref),
          channelName: channel.name,
          lastSentAt: target.sentAt,
          postCount: 0,
          posts: new Set([post.id]),
        })
      }
    }
  }
  return [...links.values()]
    .map(({ posts: postIds, ...link }) => ({ ...link, postCount: postIds.size }))
    .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt))
}

export const postLinksWithStats = async (): Promise<PostLinkWithStats[]> =>
  Promise.all(
    (await listPostLinks()).map(async (link) => ({
      ...link,
      stats: await getTagStats(link.url, link.tag),
    }))
  )
