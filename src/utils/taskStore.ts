// Task database access shared by the Telegram task board API (/api/tasks/**)
// and the AI agent API (/api/agent/tasks/**), so both behave the same.
import pool from './db_pg'
import { sendTelegramDM } from './telegram'
import { markdownToTelegramHtml } from './markdownLinks'
import type { Task, TaskAssignee, TaskState } from '../types/types'
import { TASK_STATES } from '../types/types'

export type AssigneeInput = { tgUserId: string; tgUserName: string }

export type CreateTaskInput = {
  name: string
  description?: string
  aiContext?: string
  aiContextConfidence?: string
  deadline?: string
  startTime?: string
  state?: TaskState
  assignees?: AssigneeInput[]
  createdByTgId?: string
  createdByTgName?: string
}

export type UpdateTaskInput = {
  name?: string
  description?: string | null
  aiContext?: string | null
  aiContextConfidence?: string | null
  deadline?: string | null
  startTime?: string | null
  state?: TaskState
  position?: number
  assignees?: AssigneeInput[]
}

type TaskRow = {
  id: string
  name: string
  description: string | null
  ai_context: string | null
  ai_context_confidence: string | null
  deadline: Date | null
  start_time: Date | null
  state: TaskState
  created_by_tg_id: string | null
  created_by_tg_name: string | null
  position: number
  created_at: Date
  updated_at: Date
  done_at: Date | null
}

type AssigneeRow = {
  task_id: string
  tg_user_id: string
  tg_user_name: string
  first_name: string | null
  last_name: string | null
}

const TASK_COLUMNS = `id, name, description, ai_context, ai_context_confidence, deadline, start_time, state,
  created_by_tg_id, created_by_tg_name, position, created_at, updated_at, done_at`

export const isTaskState = (s: unknown): s is TaskState =>
  (TASK_STATES as readonly unknown[]).includes(s)

const toISOOrUndefined = (d: Date | null): string | undefined => (d ? d.toISOString() : undefined)

const rowToTask = (row: TaskRow, assignees: TaskAssignee[]): Task => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  aiContext: row.ai_context ?? undefined,
  aiContextConfidence: row.ai_context_confidence ?? undefined,
  deadline: toISOOrUndefined(row.deadline),
  startTime: toISOOrUndefined(row.start_time),
  state: row.state,
  assignees,
  createdByTgId: row.created_by_tg_id ?? undefined,
  createdByTgName: row.created_by_tg_name ?? undefined,
  position: row.position,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  doneAt: toISOOrUndefined(row.done_at),
})

const validAssignees = (assignees: AssigneeInput[] | undefined): AssigneeInput[] =>
  Array.isArray(assignees) ? assignees.filter((a) => a.tgUserId && a.tgUserName) : []

// Assignees with their real names from tg_users when known
const getAssignees = async (taskIds: string[]): Promise<Record<string, TaskAssignee[]>> => {
  if (taskIds.length === 0) return {}
  const result = await pool.query<AssigneeRow>(
    `SELECT ta.task_id, ta.tg_user_id, ta.tg_user_name, tu.first_name, tu.last_name
     FROM task_assignees ta
     LEFT JOIN tg_users tu ON ta.tg_user_id = tu.tg_user_id
     WHERE ta.task_id = ANY($1)`,
    [taskIds]
  )
  return result.rows.reduce(
    (acc, row) => {
      if (!acc[row.task_id]) acc[row.task_id] = []
      const realName = row.first_name
        ? `${row.first_name}${row.last_name ? ' ' + row.last_name : ''}`
        : undefined
      acc[row.task_id].push({
        tgUserId: row.tg_user_id,
        tgUserName: realName ?? row.tg_user_name,
        firstName: row.first_name ?? undefined,
        lastName: row.last_name ?? undefined,
      })
      return acc
    },
    {} as Record<string, TaskAssignee[]>
  )
}

export const listTasks = async (states?: TaskState[]): Promise<Task[]> => {
  const result =
    states && states.length > 0
      ? await pool.query<TaskRow>(
          `SELECT ${TASK_COLUMNS} FROM tasks WHERE state = ANY($1) ORDER BY position ASC, created_at ASC`,
          [states]
        )
      : await pool.query<TaskRow>(
          `SELECT ${TASK_COLUMNS} FROM tasks ORDER BY position ASC, created_at ASC`
        )
  const assignees = await getAssignees(result.rows.map((r) => r.id))
  return result.rows.map((row) => rowToTask(row, assignees[row.id] ?? []))
}

export const getTask = async (taskId: string): Promise<Task | null> => {
  const result = await pool.query<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1`, [
    taskId,
  ])
  if (result.rows.length === 0) return null
  const assignees = await getAssignees([taskId])
  return rowToTask(result.rows[0], assignees[taskId] ?? [])
}

const notifyNewAssignees = async (task: Task, assignees: AssigneeInput[]) => {
  const notifyAssignees = assignees.filter((a) => a.tgUserId !== task.createdByTgId)
  if (notifyAssignees.length === 0) return

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const settingsResult = await pool.query(
    `SELECT tg_user_id, notify_creation FROM task_notification_settings WHERE tg_user_id = ANY($1)`,
    [notifyAssignees.map((a) => a.tgUserId)]
  )
  const settingsMap = new Map(
    settingsResult.rows.map((r: { tg_user_id: string; notify_creation: boolean }) => [
      r.tg_user_id,
      r.notify_creation,
    ])
  )

  const lines = [`📋 <b>New task assigned to you</b>\n\n<b>${task.name}</b>`]
  if (task.description) lines.push(markdownToTelegramHtml(task.description))
  if (task.aiContext) {
    const confidence = task.aiContextConfidence ? ` (${task.aiContextConfidence})` : ''
    lines.push(
      `\n🤖 <b>Context (ai generated)</b>${confidence}\n${markdownToTelegramHtml(task.aiContext)}`
    )
  }
  if (task.deadline) lines.push(`📅 Deadline: ${formatDate(task.deadline)}`)
  if (task.startTime) lines.push(`🗓 Start: ${formatDate(task.startTime)}`)
  if (task.createdByTgName) lines.push(`\nCreated by ${task.createdByTgName}`)
  const message = lines.join('\n')

  await Promise.allSettled(
    notifyAssignees
      .filter((a) => settingsMap.get(a.tgUserId) !== false)
      .map((a) => sendTelegramDM(a.tgUserId, message))
  )
}

// Creates a task at the end of the board and DMs its assignees on Telegram
export const createTask = async (input: CreateTaskInput): Promise<Task> => {
  const state = isTaskState(input.state) ? input.state : 'todo'
  const assignees = validAssignees(input.assignees)

  const client = await pool.connect()
  let task: Task
  try {
    await client.query('BEGIN')

    const maxPosResult = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks'
    )
    const nextPos = maxPosResult.rows[0].next_pos

    const taskResult = await client.query<TaskRow>(
      `INSERT INTO tasks (name, description, ai_context, ai_context_confidence, deadline, start_time, state,
                          created_by_tg_id, created_by_tg_name, position, done_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${TASK_COLUMNS}`,
      [
        input.name.trim(),
        input.description?.trim() || null,
        input.aiContext?.trim() || null,
        input.aiContextConfidence?.trim() || null,
        input.deadline || null,
        input.startTime || null,
        state,
        input.createdByTgId || null,
        input.createdByTgName || null,
        nextPos,
        state === 'done' ? new Date().toISOString() : null,
      ]
    )
    task = rowToTask(taskResult.rows[0], assignees)

    for (const a of assignees) {
      await client.query(
        'INSERT INTO task_assignees (task_id, tg_user_id, tg_user_name) VALUES ($1, $2, $3)',
        [task.id, a.tgUserId, a.tgUserName]
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  void notifyNewAssignees(task, assignees)
  return task
}

// Returns null if the task doesn't exist. Fields left undefined are kept;
// `assignees` replaces the whole list.
export const updateTask = async (taskId: string, input: UpdateTaskInput): Promise<Task | null> => {
  const sets: string[] = []
  const params: (string | number | null)[] = []
  const set = (column: string, value: string | number | null) => {
    params.push(value)
    sets.push(`${column} = $${params.length}`)
  }

  if (input.name !== undefined) set('name', input.name)
  if (input.description !== undefined) set('description', input.description)
  if (input.aiContext !== undefined) set('ai_context', input.aiContext)
  if (input.aiContextConfidence !== undefined) {
    set('ai_context_confidence', input.aiContextConfidence)
  }
  if (input.deadline !== undefined) set('deadline', input.deadline || null)
  if (input.startTime !== undefined) set('start_time', input.startTime || null)
  if (input.state !== undefined && isTaskState(input.state)) {
    set('state', input.state)
    sets.push(input.state === 'done' ? 'done_at = now()' : 'done_at = NULL')
  }
  if (input.position !== undefined) set('position', input.position)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (sets.length > 0) {
      sets.push('updated_at = now()')
      params.push(taskId)
      const result = await client.query(
        `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
        params
      )
      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return null
      }
    }

    if (input.assignees !== undefined) {
      await client.query('DELETE FROM task_assignees WHERE task_id = $1', [taskId])
      for (const a of validAssignees(input.assignees)) {
        await client.query(
          'INSERT INTO task_assignees (task_id, tg_user_id, tg_user_name) VALUES ($1, $2, $3)',
          [taskId, a.tgUserId, a.tgUserName]
        )
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return getTask(taskId)
}

export const hasTaskChanges = (input: UpdateTaskInput): boolean =>
  (
    [
      'name',
      'description',
      'aiContext',
      'aiContextConfidence',
      'deadline',
      'startTime',
      'state',
      'position',
      'assignees',
    ] as const
  ).some((key) => input[key] !== undefined)

// Returns false if the task doesn't exist
export const deleteTask = async (taskId: string): Promise<boolean> => {
  const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [taskId])
  return result.rows.length > 0
}

export const searchTaskUsers = async (q: string) => {
  const result = q
    ? await pool.query(
        `SELECT id, tg_user_id, first_name, last_name, username
         FROM tg_users
         WHERE tg_user_id ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR username ILIKE $1
         ORDER BY first_name ASC
         LIMIT 20`,
        [`%${q}%`]
      )
    : await pool.query(
        `SELECT id, tg_user_id, first_name, last_name, username
         FROM tg_users
         ORDER BY first_name ASC
         LIMIT 20`
      )
  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id,
    tgUserId: row.tg_user_id as string,
    firstName: row.first_name as string,
    lastName: (row.last_name as string | null) ?? undefined,
    username: (row.username as string | null) ?? undefined,
  }))
}

// Assignees for the given Telegram user ids, or the ids that aren't known users
export const resolveAssignees = async (
  tgUserIds: string[]
): Promise<{ assignees: AssigneeInput[]; unknownIds: string[] }> => {
  const result = await pool.query<{
    tg_user_id: string
    first_name: string
    last_name: string | null
  }>('SELECT tg_user_id, first_name, last_name FROM tg_users WHERE tg_user_id = ANY($1)', [
    tgUserIds,
  ])
  const assignees = result.rows.map((row) => ({
    tgUserId: row.tg_user_id,
    tgUserName: row.last_name ? `${row.first_name} ${row.last_name}` : row.first_name,
  }))
  return {
    assignees,
    unknownIds: tgUserIds.filter((id) => !assignees.some((a) => a.tgUserId === id)),
  }
}
