import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { parseJsonBody } from '../../../../utils/apiUtils'
import { sendTelegramDM } from '../../../../utils/telegram'
import { markdownToTelegramHtml } from '../../../../utils/markdownLinks'
import type { TaskState } from '../../../../types/types'

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

const VALID_STATES: readonly string[] = ['someday', 'todo', 'in_progress', 'done'] satisfies readonly TaskState[]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = parseJsonBody<CreateTaskBody>(req)

  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }

  const state = body.state && VALID_STATES.includes(body.state) ? body.state : 'todo'

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const maxPosResult = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks'
    )
    const nextPos = maxPosResult.rows[0].next_pos

    const taskResult = await client.query(
      `INSERT INTO tasks (name, description, deadline, start_time, state,
                          created_by_tg_id, created_by_tg_name, position, done_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, description, deadline, start_time, state,
                 created_by_tg_id, created_by_tg_name, position, created_at, updated_at, done_at`,
      [
        body.name.trim(),
        body.description?.trim() || null,
        body.deadline || null,
        body.startTime || null,
        state,
        body.createdByTgId || null,
        body.createdByTgName || null,
        nextPos,
        state === 'done' ? new Date().toISOString() : null,
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

    const notifyAssignees = assignees.filter(
      (a) => a.tgUserId && a.tgUserName && a.tgUserId !== body.createdByTgId
    )
    if (notifyAssignees.length > 0) {
      const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

      const settingsResult = await pool.query(
        `SELECT tg_user_id, notify_creation FROM task_notification_settings
         WHERE tg_user_id = ANY($1)`,
        [notifyAssignees.map((a) => a.tgUserId)]
      )
      const settingsMap = new Map(
        settingsResult.rows.map((r: { tg_user_id: string; notify_creation: boolean }) => [r.tg_user_id, r.notify_creation])
      )

      const lines = [`📋 <b>New task assigned to you</b>\n\n<b>${task.name}</b>`]
      if (task.description) lines.push(markdownToTelegramHtml(task.description))
      if (task.deadline) lines.push(`📅 Deadline: ${formatDate(task.deadline.toISOString())}`)
      if (task.start_time) lines.push(`🗓 Start: ${formatDate(task.start_time.toISOString())}`)
      lines.push(`\nCreated by ${body.createdByTgName || 'someone'}`)
      const message = lines.join('\n')

      void Promise.allSettled(
        notifyAssignees
          .filter((a) => settingsMap.get(a.tgUserId) !== false)
          .map((a) => sendTelegramDM(a.tgUserId, message))
      )
    }

    return res.status(201).json({
      task: {
        id: task.id,
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
        doneAt: task.done_at ? task.done_at.toISOString() : undefined,
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
