import { parseJsonBody } from '../../../utils/apiUtils'
import { getPostOrThrow, postFromInput } from '../../../utils/postStore'
import { adminRoute } from '../../../utils/social/adminApi'
import { buildPreview } from '../../../utils/social/preview'
import type { PostInput } from '../../../utils/social/types'

// Admin: preview of the editor's unsaved post
export default adminRoute({
  POST: async (req) => {
    const body = parseJsonBody<{ id?: string; post: PostInput }>(req)
    const existing = body?.id ? await getPostOrThrow(body.id) : null
    return { preview: await buildPreview(await postFromInput(body?.post ?? {}, existing)) }
  },
})
