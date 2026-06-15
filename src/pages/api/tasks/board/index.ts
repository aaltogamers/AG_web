import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import type { Task, TaskAssignee, TaskState } from '../../../../types/types'

type TaskRow = {
  id: string
  board_id: string
  name: string
  description: string | null
  deadline: Date | null
  start_time: Date | null
  state: TaskState
  created_by_tg_id: string | null
  created_by_tg_name: string | null
  position: number
  created_at: Date
  updated_at: Date
}

type AssigneeRow = {
  task_id: string
  tg_user_id: string
  tg_user_name: string
  first_name: string | null
  last_name: string | null
}

const toISOOrUndefined = (d: Date | null): string | undefined =>
  d ? d.toISOString() : undefined

const rowToTask = (row: TaskRow, assignees: TaskAssignee[]): Task => ({
  id: row.id,
  boardId: row.board_id,
  name: row.name,
  description: row.description ?? undefined,
  deadline: toISOOrUndefined(row.deadline),
  startTime: toISOOrUndefined(row.start_time),
  state: row.state,
  assignees,
  createdByTgId: row.created_by_tg_id ?? undefined,
  createdByTgName: row.created_by_tg_name ?? undefined,
  position: row.position,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
})

const BOARD_ID = 1

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tasksResult = await pool.query<TaskRow>(
    `SELECT id, board_id, name, description, deadline, start_time, state,
            created_by_tg_id, created_by_tg_name, position, created_at, updated_at
     FROM tasks
     WHERE board_id = $1
     ORDER BY position ASC, created_at ASC`,
    [BOARD_ID]
  )

  const taskIds = tasksResult.rows.map((r) => r.id)
  let assigneesByTask: Record<string, TaskAssignee[]> = {}

  if (taskIds.length > 0) {
    const assigneesResult = await pool.query<AssigneeRow>(
      `SELECT ta.task_id, ta.tg_user_id, ta.tg_user_name,
              tu.first_name, tu.last_name
       FROM task_assignees ta
       LEFT JOIN tg_users tu ON ta.tg_user_id = tu.tg_user_id
       WHERE ta.task_id = ANY($1)`,
      [taskIds]
    )
    assigneesByTask = assigneesResult.rows.reduce(
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

  const tasks = tasksResult.rows.map((row) => rowToTask(row, assigneesByTask[row.id] ?? []))

  return res.status(200).json({ tasks })
}
