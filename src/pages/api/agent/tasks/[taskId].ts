import type { NextApiRequest } from 'next'
import { AgentError, agentHandler, getBody } from '../../../../utils/agentApi'
import { describeTask, parseTaskInput } from '../../../../utils/agentTasks'
import { deleteTask, getTask, hasTaskChanges, updateTask } from '../../../../utils/taskStore'

const taskIdOf = (req: NextApiRequest) => String(req.query.taskId)
const notFound = (req: NextApiRequest) => new AgentError(404, `No task with id "${taskIdOf(req)}"`)

export default agentHandler({
  GET: async (req) => {
    const task = await getTask(taskIdOf(req))
    if (!task) throw notFound(req)
    return { task: describeTask(task) }
  },

  // Changes only the given fields
  PATCH: async (req) => {
    const input = await parseTaskInput(getBody(req))
    if (!hasTaskChanges(input)) throw new AgentError(400, 'Nothing to update')
    const task = await updateTask(taskIdOf(req), input)
    if (!task) throw notFound(req)
    return { task: describeTask(task) }
  },

  DELETE: async (req) => {
    if (!(await deleteTask(taskIdOf(req)))) throw notFound(req)
    return { deleted: taskIdOf(req) }
  },
})
