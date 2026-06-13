import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../../utils/db_pg'
import { parseJsonBody } from '../../../../../utils/apiUtils'
import type { TaskState } from '../../../../../types/types'

type CreateTaskBody = {
  name: string
  description?: string
  deadline?: string
  startTime?: string
  state?: TaskState
  assignees?: { tgUserId: string; tgUserName: string }[]
  createdByTgId?: string
  createdByTgName?: string
}

const VALID_STATES: readonly string[] = ['todo', 'in_progress', 'done'] satisfies readonly TaskState[]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const chatId = req.query.chatId as string
  const body = parseJsonBody<CreateTaskBody>(req)

  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }

  const state = body.state && VALID_STATES.includes(body.state) ? body.state : 'todo'

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const boardResult = await client.query(
      `INSERT INTO task_boards (chat_id)
       VALUES ($1)
       ON CONFLICT (chat_id) DO UPDATE SET chat_id = task_boards.chat_id
       RETURNING id`,
      [chatId]
    )
    const boardId = boardResult.rows[0].id

    const maxPosResult = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE board_id = $1',
      [boardId]
    )
    const nextPos = maxPosResult.rows[0].next_pos

    const taskResult = await client.query(
      `INSERT INTO tasks (board_id, name, description, deadline, start_time, state,
                          created_by_tg_id, created_by_tg_name, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, board_id, name, description, deadline, start_time, state,
                 created_by_tg_id, created_by_tg_name, position, created_at, updated_at`,
      [
        boardId,
        body.name.trim(),
        body.description?.trim() || null,
        body.deadline || null,
        body.startTime || null,
        state,
        body.createdByTgId || null,
        body.createdByTgName || null,
        nextPos,
      ]
    )
    const task = taskResult.rows[0]

    const assignees = Array.isArray(body.assignees) ? body.assignees : []
    for (const a of assignees) {
      if (a.tgUserId && a.tgUserName) {
        await client.query(
          'INSERT INTO task_assignees (task_id, tg_user_id, tg_user_name) VALUES ($1, $2, $3)',
          [task.id, a.tgUserId, a.tgUserName]
        )
      }
    }

    await client.query('COMMIT')

    return res.status(201).json({
      task: {
        id: task.id,
        boardId: task.board_id,
        name: task.name,
        description: task.description ?? undefined,
        deadline: task.deadline ? task.deadline.toISOString() : undefined,
        startTime: task.start_time ? task.start_time.toISOString() : undefined,
        state: task.state,
        assignees: assignees.filter((a) => a.tgUserId && a.tgUserName),
        createdByTgId: task.created_by_tg_id ?? undefined,
        createdByTgName: task.created_by_tg_name ?? undefined,
        position: task.position,
        createdAt: task.created_at.toISOString(),
        updatedAt: task.updated_at.toISOString(),
      },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[tasks] create failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  } finally {
    client.release()
  }
}
