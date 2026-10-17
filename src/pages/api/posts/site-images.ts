import { listImages } from '../../../utils/mediaStore'
import { adminRoute } from '../../../utils/social/adminApi'

// Admin: existing site images to pick from: uploaded event images and public/images
export default adminRoute({
  GET: async () => ({ images: await listImages() }),
})
