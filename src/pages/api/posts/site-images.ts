import { adminRoute } from '../../../utils/social/adminApi'
import { listSiteImages } from '../../../utils/social/media'

// Admin: existing site images to pick from
export default adminRoute({
  GET: async () => ({ images: await listSiteImages() }),
})
