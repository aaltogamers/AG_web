import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { parseJsonBody } from '../../../utils/apiUtils'
import type { TaskState } from '../../../types/types'

const VALID_STATES: readonly string[] = ['todo', 'in_progress', 'done'] satisfies readonly TaskState[]

type UpdateTaskBody = {
  name?: string
  description?: string | null
  deadline?: string | null
  startTime?: string | null
  state?: TaskState
  position?: number
  assignees?: { tgUserId: string; tgUserName: string }[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  const taskId = req.query.taskId as string

  if (req.method === 'GET') {
    const taskResult = await pool.query(
      `SELECT id, board_id, name, description, deadline, start_time, state,
              created_by_tg_id, created_by_tg_name, position, created_at, updated_at
       FROM tasks WHERE id = $1`,
      [taskId]
    )
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }
    const t = taskResult.rows[0]

    const assigneesResult = await pool.query(
      'SELECT tg_user_id, tg_user_name FROM task_assignees WHERE task_id = $1',
      [taskId]
    )

    return res.status(200).json({
      task: {
        id: t.id,
        boardId: t.board_id,
        name: t.name,
        description: t.description ?? undefined,
        deadline: t.deadline ? t.deadline.toISOString() : undefined,
        startTime: t.start_time ? t.start_time.toISOString() : undefined,
        state: t.state,
        assignees: assigneesResult.rows.map((r: { tg_user_id: string; tg_user_name: string }) => ({
          tgUserId: r.tg_user_id,
          tgUserName: r.tg_user_name,
        })),
        createdByTgId: t.created_by_tg_id ?? undefined,
        createdByTgName: t.created_by_tg_name ?? undefined,
        position: t.position,
        createdAt: t.created_at.toISOString(),
        updatedAt: t.updated_at.toISOString(),
      },
    })
  }

  if (req.method === 'PUT') {
    const body = parseJsonBody<UpdateTaskBody>(req)
    if (!body) {
      return res.status(400).json({ error: 'Invalid body' })
    }

    const sets: string[] = []
    const params: (string | number | null)[] = []
    let paramIdx = 1

    if (body.name !== undefined) {
      sets.push(`name = $${paramIdx++}`)
      params.push(body.name)
    }
    if (body.description !== undefined) {
      sets.push(`description = $${paramIdx++}`)
      params.push(body.description)
    }
    if (body.deadline !== undefined) {
      sets.push(`deadline = $${paramIdx++}`)
      params.push(body.deadline)
    }
    if (body.startTime !== undefined) {
      sets.push(`start_time = $${paramIdx++}`)
      params.push(body.startTime)
    }
    if (body.state !== undefined && VALID_STATES.includes(body.state)) {
      sets.push(`state = $${paramIdx++}`)
      params.push(body.state)
    }
    if (body.position !== undefined) {
      sets.push(`position = $${paramIdx++}`)
      params.push(body.position)
    }

    if (sets.length === 0 && !body.assignees) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      if (sets.length > 0) {
        sets.push(`updated_at = now()`)
        params.push(taskId)
        const sql = `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING id`
        const result = await client.query(sql, params)
        if (result.rows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ error: 'Task not found' })
        }
      }

      if (body.assignees !== undefined) {
        await client.query('DELETE FROM task_assignees WHERE task_id = $1', [taskId])
        for (const a of body.assignees) {
          if (a.tgUserId && a.tgUserName) {
            await client.query(
              'INSERT INTO task_assignees (task_id, tg_user_id, tg_user_name) VALUES ($1, $2, $3)',
              [taskId, a.tgUserId, a.tgUserName]
            )
          }
        }
      }

      await client.query('COMMIT')

      const updated = await pool.query(
        `SELECT id, board_id, name, description, deadline, start_time, state,
                created_by_tg_id, created_by_tg_name, position, created_at, updated_at
         FROM tasks WHERE id = $1`,
        [taskId]
      )
      const assigneesResult = await pool.query(
        'SELECT tg_user_id, tg_user_name FROM task_assignees WHERE task_id = $1',
        [taskId]
      )
      const t = updated.rows[0]

      return res.status(200).json({
        task: {
          id: t.id,
          boardId: t.board_id,
          name: t.name,
          description: t.description ?? undefined,
          deadline: t.deadline ? t.deadline.toISOString() : undefined,
          startTime: t.start_time ? t.start_time.toISOString() : undefined,
          state: t.state,
          assignees: assigneesResult.rows.map(
            (r: { tg_user_id: string; tg_user_name: string }) => ({
              tgUserId: r.tg_user_id,
              tgUserName: r.tg_user_name,
            })
          ),
          createdByTgId: t.created_by_tg_id ?? undefined,
          createdByTgName: t.created_by_tg_name ?? undefined,
          position: t.position,
          createdAt: t.created_at.toISOString(),
          updatedAt: t.updated_at.toISOString(),
        },
      })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[tasks] update failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    } finally {
      client.release()
    }
  }

  if (req.method === 'DELETE') {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [taskId])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
