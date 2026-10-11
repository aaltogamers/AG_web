import { AgentError } from '../../../../utils/agentApi'
import { parseJsonBody } from '../../../../utils/apiUtils'
import {
  approvePost,
  deletePost,
  releaseHeldPost,
  requestApproval,
  unschedulePost,
  withdrawApproval,
} from '../../../../utils/social/actions'
import { adminRoute, routeParam } from '../../../../utils/social/adminApi'

type Body = { version?: number; newTime?: string | null }

// Admin: request-approval, approve, unschedule, delete, withdraw, retry, send-anyway
export default adminRoute({
  POST: async (req) => {
    const id = routeParam(req, 'id')
    const body = parseJsonBody<Body>(req) ?? {}
    const version = Number(body.version)
    const needsVersion = () => {
      if (!Number.isInteger(version)) throw new AgentError(400, 'version is required')
      return version
    }
    switch (routeParam(req, 'action')) {
      case 'request-approval':
        return requestApproval(id, 'admin')
      case 'approve':
        return { post: await approvePost(id, needsVersion(), 'admin') }
      case 'unschedule':
        return { post: await unschedulePost(id, 'admin') }
      case 'delete':
        await deletePost(id, 'admin')
        return {}
      case 'withdraw':
        return { post: await withdrawApproval(id, 'admin') }
      case 'retry':
        return { post: await releaseHeldPost(id, needsVersion(), 'admin', 'retry', body.newTime ?? null) }
      case 'send-anyway':
        return {
          post: await releaseHeldPost(id, needsVersion(), 'admin', 'send_anyway', body.newTime ?? null),
        }
      default:
        throw new AgentError(404, 'Unknown action')
    }
  },
})
