import { parseJsonBody } from '../../../../utils/apiUtils'
import { getPostHistory, getPostOrThrow } from '../../../../utils/postStore'
import { editPost } from '../../../../utils/social/actions'
import { adminRoute, routeParam } from '../../../../utils/social/adminApi'
import { buildPreview } from '../../../../utils/social/preview'
import type { PostInput } from '../../../../utils/social/types'

// Admin: a post with its history and preview, and editing it (optionally approving in the same step)
export default adminRoute({
  GET: async (req) => {
    const post = await getPostOrThrow(routeParam(req, 'id'))
    const [history, preview] = await Promise.all([getPostHistory(post.id), buildPreview(post)])
    return { post, history, preview }
  },
  PUT: async (req) => {
    const body = parseJsonBody<{ post: PostInput; approve?: boolean }>(req)
    return editPost(routeParam(req, 'id'), body?.post ?? {}, 'admin', { approve: !!body?.approve })
  },
})
