import { AgentError } from '../../../../utils/agentApi'
import { parseJsonBody } from '../../../../utils/apiUtils'
import { adminRoute } from '../../../../utils/social/adminApi'
import { saveUploadedImage } from '../../../../utils/social/media'

// Admin: uploads an image (base64 in JSON), converted to JPEG
export const config = { api: { bodyParser: { sizeLimit: '21mb' } } }

export default adminRoute({
  POST: async (req) => {
    const body = parseJsonBody<{ data?: string }>(req)
    if (!body?.data) throw new AgentError(400, 'data is required')
    return saveUploadedImage(Buffer.from(body.data.replace(/^data:[^,]*,/, ''), 'base64'))
  },
})
