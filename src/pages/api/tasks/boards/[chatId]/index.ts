import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../../utils/db_pg'
import { getQueryParam } from '../../../../../utils/apiUtils'
import type { Task, TaskAssignee, TaskState } from '../../../../../types/types'

type BoardRow = {
  id: string
  chat_id: string
  name: string
  created_at: Date
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const chatId = req.query.chatId as string
  const name = getQueryParam(req, 'name') || null
  const noCreate = getQueryParam(req, 'noCreate') === 'true'

  let board: BoardRow

  if (noCreate) {
    const result = await pool.query<BoardRow>(
      'SELECT id, chat_id, name, created_at FROM task_boards WHERE chat_id = $1',
      [chatId]
    )
    if (result.rows.length === 0) {
      return res.status(200).json({ board: null, tasks: [] })
    }
    board = result.rows[0]
    if (name && board.name !== name) {
      await pool.query('UPDATE task_boards SET name = $1 WHERE id = $2', [name, board.id])
      board.name = name
    }
  } else {
    const boardResult = await pool.query<BoardRow>(
      `INSERT INTO task_boards (chat_id, name)
       VALUES ($1, COALESCE($2, 'Task Board'))
       ON CONFLICT (chat_id) DO UPDATE
         SET name = COALESCE($2, task_boards.name)
       RETURNING id, chat_id, name, created_at`,
      [chatId, name]
    )
    board = boardResult.rows[0]
  }

  const tasksResult = await pool.query<TaskRow>(
    `SELECT id, board_id, name, description, deadline, start_time, state,
            created_by_tg_id, created_by_tg_name, position, created_at, updated_at
     FROM tasks
     WHERE board_id = $1
     ORDER BY position ASC, created_at ASC`,
    [board.id]
  )

  const taskIds = tasksResult.rows.map((r) => r.id)
  let assigneesByTask: Record<string, TaskAssignee[]> = {}

  if (taskIds.length > 0) {
    const assigneesResult = await pool.query<AssigneeRow>(
      `SELECT ta.task_id, ta.tg_user_id, ta.tg_user_name,
              tu.first_name, tu.last_name
       FROM task_assignees ta
       LEFT JOIN tg_users tu ON ta.tg_user_id = tu.tg_user_id AND tu.chat_id = $2
       WHERE ta.task_id = ANY($1)`,
      [taskIds, chatId]
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

  return res.status(200).json({
    board: {
      id: board.id,
      chatId: board.chat_id,
      name: board.name,
      createdAt: board.created_at.toISOString(),
    },
    tasks,
  })
}
