import { getSettings } from '../../../utils/postStore'
import { adminRoute } from '../../../utils/social/adminApi'
import { getPostsBotInfo, setPostsWebhook } from '../../../utils/social/telegram'

// Admin: the posts bot's status, and "Connect bot", which points its webhook at this site
export default adminRoute({
  GET: async () => ({ bot: await getPostsBotInfo() }),
  POST: async () => {
    const { website } = await getSettings()
    await setPostsWebhook(`${website.baseUrl}/api/telegram/posts-webhook`)
    return { bot: await getPostsBotInfo() }
  },
})
