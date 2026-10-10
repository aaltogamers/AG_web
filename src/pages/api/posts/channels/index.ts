import { parseJsonBody } from '../../../../utils/apiUtils'
import { type ChannelInput, createChannel, listChannels } from '../../../../utils/postStore'
import { adminRoute } from '../../../../utils/social/adminApi'

// Admin: list channels and add one
export default adminRoute({
  GET: async () => ({ channels: await listChannels() }),
  POST: async (req) => ({ channel: await createChannel(parseJsonBody<ChannelInput>(req) ?? {}) }),
})
