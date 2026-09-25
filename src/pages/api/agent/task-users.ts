import { agentHandler } from '../../../utils/agentApi'
import { searchTaskUsers } from '../../../utils/taskStore'

export default agentHandler({
  // `?q=` searches by name, username or Telegram id
  GET: async (req) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    return { users: await searchTaskUsers(q) }
  },
})
