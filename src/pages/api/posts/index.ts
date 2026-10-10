import { parseJsonBody } from '../../../utils/apiUtils'
import { countAwaitingApproval, listPosts } from '../../../utils/postStore'
import { approvePost, createPostAction } from '../../../utils/social/actions'
import { adminRoute, routeParam } from '../../../utils/social/adminApi'
import { POST_STATUSES, type PostInput, type PostStatus } from '../../../utils/social/types'

// Admin: list posts (?status=a,b&from=&to=&event=) and create one
export default adminRoute({
  GET: async (req) => {
    const statuses = routeParam(req, 'status')
      .split(',')
      .filter((s): s is PostStatus => (POST_STATUSES as readonly string[]).includes(s))
    const [posts, awaitingApproval] = await Promise.all([
      listPosts({
        statuses,
        from: routeParam(req, 'from') || undefined,
        to: routeParam(req, 'to') || undefined,
        eventSlug: routeParam(req, 'event') || undefined,
      }),
      countAwaitingApproval(),
    ])
    return { posts, awaitingApproval }
  },
  POST: async (req) => {
    const body = parseJsonBody<{ post: PostInput; approve?: boolean }>(req)
    const post = await createPostAction(body?.post ?? {}, 'admin')
    if (body?.approve) return { post: await approvePost(post.id, post.version, 'admin') }
    return { post }
  },
})
