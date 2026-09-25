import { AgentError, agentHandler, getBody } from '../../../../utils/agentApi'
import { describeTask, parseTaskInput } from '../../../../utils/agentTasks'
import { createTask, isTaskState, listTasks } from '../../../../utils/taskStore'

export default agentHandler({
  // `?state=todo,in_progress` filters by state
  GET: async (req) => {
    const stateParam = typeof req.query.state === 'string' ? req.query.state : ''
    const states = stateParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!states.every(isTaskState)) {
      throw new AgentError(
        400,
        'state must be a comma-separated list of someday, todo, in_progress, done'
      )
    }
    return { tasks: (await listTasks(states)).map(describeTask) }
  },

  POST: async (req) => {
    const input = await parseTaskInput(getBody(req))
    if (!input.name) throw new AgentError(400, 'name is required')
    const task = await createTask({
      ...input,
      name: input.name,
      description: input.description ?? undefined,
      aiContext: input.aiContext ?? undefined,
      aiContextConfidence: input.aiContextConfidence ?? undefined,
      deadline: input.deadline ?? undefined,
      startTime: input.startTime ?? undefined,
      createdByTgName: 'AI agent',
    })
    return { task: describeTask(task) }
  },
})
