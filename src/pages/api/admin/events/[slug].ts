import { AgentError } from '../../../../utils/agentApi'
import { parseJsonBody } from '../../../../utils/apiUtils'
import { deleteEventAsAdmin, updateEventAsAdmin } from '../../../../utils/adminEvents'
import { adminRoute, routeParam } from '../../../../utils/social/adminApi'

const parseVersion = (raw: unknown) => {
  const version = Number(raw)
  if (!Number.isInteger(version) || version < 1) throw new AgentError(400, 'version is required')
  return version
}

// Admin: saves (with the version the editor loaded) or deletes an event
export default adminRoute({
  PUT: async (req) => {
    const body = parseJsonBody<{ data?: Record<string, unknown>; body?: string; version?: number }>(req)
    if (!body?.data) throw new AgentError(400, 'data is required')
    return updateEventAsAdmin(routeParam(req, 'slug'), body.data, String(body.body ?? ''), parseVersion(body.version))
  },
  DELETE: async (req) => {
    await deleteEventAsAdmin(routeParam(req, 'slug'), parseVersion(routeParam(req, 'version')))
  },
})
