import { AgentError } from '../../../utils/agentApi'
import { parseJsonBody } from '../../../utils/apiUtils'
import { getSettings } from '../../../utils/postStore'
import { adminRoute } from '../../../utils/social/adminApi'
import { listGuildChannels, testDiscordChannel } from '../../../utils/social/discord'

const guildId = async () => {
  const { discord } = await getSettings()
  if (!discord.guildId) throw new AgentError(400, 'Set the Discord server id first')
  return discord.guildId
}

// Admin: the server's text and announcement channels, and testing that the bot can post in one
export default adminRoute({
  GET: async () => ({ channels: await listGuildChannels(await guildId()) }),
  POST: async (req) => {
    const body = parseJsonBody<{ channelId?: string; crosspost?: boolean }>(req)
    if (!body?.channelId) throw new AgentError(400, 'channelId is required')
    return testDiscordChannel(await guildId(), { channelId: body.channelId, crosspost: !!body.crosspost })
  },
})
