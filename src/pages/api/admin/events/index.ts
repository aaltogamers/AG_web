import { AgentError } from '../../../../utils/agentApi'
import { parseJsonBody } from '../../../../utils/apiUtils'
import { createEventAsAdmin } from '../../../../utils/adminEvents'
import { listEvents } from '../../../../utils/eventStore'
import { adminRoute } from '../../../../utils/social/adminApi'

// Admin: all events with their versions, and creating one (its slug comes from the name)
export default adminRoute({
  GET: async () => ({ events: await listEvents() }),
  POST: async (req) => {
    const body = parseJsonBody<{ data?: Record<string, unknown>; body?: string }>(req)
    if (!body?.data) throw new AgentError(400, 'data is required')
    return { event: await createEventAsAdmin(body.data, String(body.body ?? '')) }
  },
})
