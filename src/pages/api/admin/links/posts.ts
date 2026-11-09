import { adminRoute } from '../../../../utils/social/adminApi'
import { postLinksWithStats } from '../../../../utils/social/postLinks'

// Admin: links in sent posts, with the channel's ref, and their visitor counts
export default adminRoute({
  GET: async () => ({ links: await postLinksWithStats() }),
})
