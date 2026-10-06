import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { TASK_STATES } from '../../types/types'
import { AgentError } from '../agentApi'
import { TASK_BOARD_URL } from '../constants'
import { describeTask, parseTaskInput } from '../agentTasks'
import {
  createTask,
  deleteTask,
  getTask,
  hasTaskChanges,
  listTasks,
  searchTaskUsers,
  updateTask,
} from '../taskStore'
import { givenArgs, runTool } from './server'

const TIME_HINT = 'Helsinki time, e.g. 2026-10-24T18:00. null clears it.'

const taskFields = {
  name: z.string(),
  description: z.string().nullable().describe('Markdown. null clears it.'),
  aiContext: z
    .string()
    .nullable()
    .describe(
      'Additional context in markdown, shown as AI generated below the description. null clears it.'
    ),
  aiContextConfidence: z
    .enum(['Very High', 'High', 'Medium', 'Low'])
    .nullable()
    .describe('How sure the AI agent is about aiContext. null clears it.'),
  deadline: z.string().nullable().describe(TIME_HINT),
  startTime: z.string().nullable().describe(TIME_HINT),
  state: z.enum(TASK_STATES),
  assigneeIds: z
    .array(z.string())
    .describe('Telegram user ids of the assignees, from find_task_users. Replaces all assignees.'),
}
const optionalTaskFields = z.object(taskFields).partial().shape

const notFound = (taskId: string) => new AgentError(404, `No task with id "${taskId}"`)

export const registerTaskTools = (server: McpServer) => {
  server.registerTool(
    'find_task_users',
    {
      title: 'Find task users',
      description:
        'Searches the Telegram users that tasks can be assigned to by name, username or Telegram id. Without a query, lists the first 20.',
      inputSchema: { q: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    runTool('find_task_users', async ({ q }) => ({ users: await searchTaskUsers(q?.trim() ?? '') }))
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description: 'Lists tasks on the task board, optionally only those in the given states.',
      inputSchema: { states: z.array(z.enum(TASK_STATES)).optional() },
      annotations: { readOnlyHint: true },
    },
    runTool('list_tasks', async ({ states }) => ({
      tasks: (await listTasks(states ?? [])).map(describeTask),
      taskBoardUrl: TASK_BOARD_URL,
    }))
  )

  server.registerTool(
    'get_task',
    {
      title: 'Get task',
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: true },
    },
    runTool('get_task', async ({ taskId }) => {
      const task = await getTask(taskId)
      if (!task) throw notFound(taskId)
      return { task: describeTask(task), taskBoardUrl: TASK_BOARD_URL }
    })
  )

  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description: 'Creates a task on the task board. Assignees are notified on Telegram.',
      inputSchema: {
        ...optionalTaskFields,
        name: taskFields.name,
        state: taskFields.state.optional().describe('Defaults to todo'),
      },
    },
    runTool('create_task', async (args) => {
      const input = await parseTaskInput(givenArgs(args))
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
      return { task: describeTask(task), taskBoardUrl: TASK_BOARD_URL }
    })
  )

  server.registerTool(
    'update_task',
    {
      title: 'Update task',
      description: 'Changes only the given fields of a task.',
      inputSchema: { taskId: z.string(), ...optionalTaskFields },
      annotations: { idempotentHint: true },
    },
    runTool('update_task', async ({ taskId, ...fields }) => {
      const input = await parseTaskInput(givenArgs(fields))
      if (!hasTaskChanges(input)) throw new AgentError(400, 'Nothing to update')
      const task = await updateTask(taskId, input)
      if (!task) throw notFound(taskId)
      return { task: describeTask(task), taskBoardUrl: TASK_BOARD_URL }
    })
  )

  server.registerTool(
    'delete_task',
    {
      title: 'Delete task',
      inputSchema: { taskId: z.string() },
      annotations: { destructiveHint: true },
    },
    runTool('delete_task', async ({ taskId }) => {
      if (!(await deleteTask(taskId))) throw notFound(taskId)
      return { deleted: taskId }
    })
  )
}
