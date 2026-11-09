import { parseJsonBody } from '../../../../utils/apiUtils'
import { adminRoute } from '../../../../utils/social/adminApi'
import { createTaggedLink, listTaggedLinks, withStats } from '../../../../utils/taggedLinkStore'

// Admin: tagged links with their visit counts, and saving a new one
export default adminRoute({
  GET: async () => ({
    links: await withStats(await listTaggedLinks()),
    statsEnabled: Boolean(process.env.UMAMI_API_KEY),
  }),
  POST: async (req) => ({
    link: await createTaggedLink(parseJsonBody<Record<string, unknown>>(req) ?? {}),
  }),
})
