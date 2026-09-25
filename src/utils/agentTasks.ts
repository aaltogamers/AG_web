// Task input and output of the AI agent API (/api/agent/tasks)
import type { Task } from '../types/types'
import {
  AgentError,
  formatAgentTime,
  optionalArray,
  optionalString,
  parseAgentTime,
  requireString,
} from './agentApi'
import { isTaskState, resolveAssignees, type UpdateTaskInput } from './taskStore'

const TASK_FIELDS = [
  'name',
  'description',
  'aiContext',
  'aiContextConfidence',
  'deadline',
  'startTime',
  'state',
  'assigneeIds',
]

// Only the given fields are returned; `null` or "" clears an optional field
export const parseTaskInput = async (input: Record<string, unknown>): Promise<UpdateTaskInput> => {
  const unknown = Object.keys(input).filter((k) => !TASK_FIELDS.includes(k))
  if (unknown.length) {
    throw new AgentError(
      400,
      `Unknown fields: ${unknown.join(', ')}. Allowed: ${TASK_FIELDS.join(', ')}`
    )
  }

  const out: UpdateTaskInput = {}
  if ('name' in input) out.name = requireString(input.name, 'name')
  for (const key of ['description', 'aiContext', 'aiContextConfidence'] as const) {
    if (key in input) out[key] = optionalString(input[key], key) ?? null
  }
  for (const key of ['deadline', 'startTime'] as const) {
    if (key in input) {
      out[key] = input[key] ? parseAgentTime(input[key], key).toISOString() : null
    }
  }
  if ('state' in input) {
    if (!isTaskState(input.state)) {
      throw new AgentError(400, 'state must be someday, todo, in_progress or done')
    }
    out.state = input.state
  }
  if ('assigneeIds' in input) {
    const ids = (optionalArray(input.assigneeIds, 'assigneeIds') ?? []).map(String)
    const { assignees, unknownIds } = await resolveAssignees(ids)
    if (unknownIds.length) {
      throw new AgentError(
        400,
        `Unknown assigneeIds: ${unknownIds.join(', ')}. Look users up with find_task_users.`
      )
    }
    out.assignees = assignees
  }
  return out
}

export const describeTask = (task: Task) => ({
  id: task.id,
  name: task.name,
  state: task.state,
  description: task.description,
  aiContext: task.aiContext,
  aiContextConfidence: task.aiContextConfidence,
  deadline: task.deadline && formatAgentTime(task.deadline),
  startTime: task.startTime && formatAgentTime(task.startTime),
  assignees: task.assignees.map((a) => ({ tgUserId: a.tgUserId, name: a.tgUserName })),
  createdBy: task.createdByTgName,
  createdAt: formatAgentTime(task.createdAt),
  doneAt: task.doneAt && formatAgentTime(task.doneAt),
})
