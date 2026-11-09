import { AgentError } from '../../../../utils/agentApi'
import { parseJsonBody } from '../../../../utils/apiUtils'
import { adminRoute, routeParam } from '../../../../utils/social/adminApi'
import { deleteTaggedLink, renameTaggedLink } from '../../../../utils/taggedLinkStore'

const notFound = () => new AgentError(404, 'Link not found')

// Admin: renames or deletes a tagged link. The link and tag can't change, so printed QR codes keep working.
export default adminRoute({
  PUT: async (req) => {
    const body = parseJsonBody<{ name?: unknown }>(req)
    const link = await renameTaggedLink(routeParam(req, 'id'), body?.name)
    if (!link) throw notFound()
    return { link }
  },
  DELETE: async (req) => {
    if (!(await deleteTaggedLink(routeParam(req, 'id')))) throw notFound()
    return { ok: true }
  },
})
