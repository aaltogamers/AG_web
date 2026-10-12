import { parseJsonBody } from '../../../utils/apiUtils'
import { getPostOrThrow, postFromInput } from '../../../utils/postStore'
import { adminRoute } from '../../../utils/social/adminApi'
import { sendTestPost } from '../../../utils/social/testPost'
import type { PostInput } from '../../../utils/social/types'

// Admin: sends one channel's text of the editor's unsaved post to the test channel
export default adminRoute({
  POST: async (req) => {
    const body = parseJsonBody<{ id?: string; post: PostInput; channelId: string }>(req)
    const existing = body?.id ? await getPostOrThrow(body.id) : null
    await sendTestPost(await postFromInput(body?.post ?? {}, existing), String(body?.channelId ?? ''))
  },
})
