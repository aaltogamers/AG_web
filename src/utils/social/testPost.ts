// "Post on test channel": sends one channel's text of a (possibly unsaved) post
// to the platform's test channel in the settings. Admin only; never the agent.
import { AgentError } from '../agentApi'
import { getSettings } from '../postStore'
import { listGuildRoles, sendToDiscordChannel } from './discord'
import { loadImage } from './media'
import { buildPreview } from './preview'
import { escapeDiscordPings } from './render'
import { sendToTelegramChannel } from './telegram'
import { PLATFORM_LABELS, type Post } from './types'

// Discord: the pings as text, e.g. "Would ping @here and @Members", so nobody is pinged
const describePings = async (pings: string[], guildId: string) => {
  const roles = pings.some((p) => /^\d+$/.test(p)) && guildId ? await listGuildRoles(guildId).catch(() => []) : []
  const names = pings.map((p) =>
    p === 'here' || p === 'everyone' ? `@${p}` : `@${roles.find((r) => r.id === p)?.name ?? p}`
  )
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
  return escapeDiscordPings(`-# Would ping ${list}`)
}

export const sendTestPost = async (post: Post, channelId: string) => {
  const target = post.targets.find((t) => t.channelId === channelId)
  if (!target) throw new AgentError(400, 'The post has no such channel')
  const settings = await getSettings()
  const preview = await buildPreview({ ...post, targets: [{ ...target, pings: [] }] })
  const rendered = preview.texts[0]
  if (!rendered) throw new AgentError(400, 'No such channel')
  const label = PLATFORM_LABELS[rendered.platform]

  if (rendered.platform === 'telegram') {
    const { testChatId, testThreadId } = settings.telegram
    if (!testChatId) throw new AgentError(400, `No ${label} test channel is set in the posts settings`)
    const images = await Promise.all(post.images.map(loadImage))
    await sendToTelegramChannel({ chatId: testChatId, threadId: testThreadId || undefined }, rendered.text, images)
    return
  }
  if (rendered.platform === 'discord') {
    const { testChannelId, guildId } = settings.discord
    if (!testChannelId) throw new AgentError(400, `No ${label} test channel is set in the posts settings`)
    const pingLine = target.pings.length ? await describePings(target.pings, guildId) : ''
    const text = [pingLine, rendered.text].filter(Boolean).join('\n')
    const images = await Promise.all(post.images.map(loadImage))
    await sendToDiscordChannel({ channelId: testChannelId }, text, images, [])
    return
  }
  throw new AgentError(400, `${label} has no test channel`)
}
