import { AgentError } from '../../../utils/agentApi'
import { parseJsonBody } from '../../../utils/apiUtils'
import { uploadEventImage } from '../../../utils/mediaStore'
import { adminRoute } from '../../../utils/social/adminApi'

// Admin: uploads an event image (base64 in JSON); returns its URL
export const config = { api: { bodyParser: { sizeLimit: '21mb' } } }

export default adminRoute({
  POST: async (req) => {
    const body = parseJsonBody<{ data?: string }>(req)
    if (!body?.data) throw new AgentError(400, 'data is required')
    return { url: await uploadEventImage(Buffer.from(body.data.replace(/^data:[^,]*,/, ''), 'base64')) }
  },
})
