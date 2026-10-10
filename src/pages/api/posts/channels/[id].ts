import { parseJsonBody } from '../../../../utils/apiUtils'
import { type ChannelInput, deleteChannel, updateChannel } from '../../../../utils/postStore'
import { adminRoute, routeParam } from '../../../../utils/social/adminApi'

// Admin: edit a channel, or delete it (only disabled if it already has posts)
export default adminRoute({
  PUT: async (req) => ({
    channel: await updateChannel(routeParam(req, 'id'), parseJsonBody<ChannelInput>(req) ?? {}),
  }),
  DELETE: async (req) => ({ result: await deleteChannel(routeParam(req, 'id')) }),
})
