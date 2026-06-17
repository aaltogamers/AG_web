import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import {
  type UserSettings,
  type AssigneeRow,
  type TaskNotificationRow,
  DEFAULT_SETTINGS,
  toHelsinkiDate,
  buildAssigneeNamesMap,
  formatTaskBlock,
} from '../../../../utils/taskNotifications'

async function resolveUserId(userParam: string): Promise<string | null> {
  if (/^\d+$/.test(userParam)) return userParam
  const username = userParam.replace(/^@/, '')
  const result = await pool.query(
    'SELECT tg_user_id FROM tg_users WHERE username ILIKE $1 LIMIT 1',
    [username]
  )
  return result.rows.length > 0 ? (result.rows[0].tg_user_id as string) : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userParam = (req.query.tgUserId ?? req.query.username) as string
  if (!userParam) return res.status(400).json({ error: 'tgUserId or username is required' })

  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  const tgUserId = await resolveUserId(userParam)
  if (!tgUserId) return res.status(404).json({ error: `User not found for "${userParam}"` })

  try {
    const { rows } = await pool.query<TaskNotificationRow>(`
      SELECT t.id AS task_id, t.name, t.description, t.state, t.deadline, t.start_time
      FROM tasks t
      JOIN task_assignees ta ON ta.task_id = t.id
      WHERE t.state != 'done'
        AND ta.tg_user_id = $1
        AND (t.deadline IS NOT NULL OR t.start_time IS NOT NULL)
      ORDER BY t.id
    `, [tgUserId])

    if (rows.length === 0) {
      return res.status(200).json({ sent: false, message: 'No tasks with dates assigned to this user' })
    }

    const taskIds = rows.map((r) => r.task_id)
    const { rows: assigneeRows } = await pool.query<AssigneeRow>(`
      SELECT ta.task_id, ta.tg_user_name,
             tu.first_name, tu.last_name
      FROM task_assignees ta
      LEFT JOIN tg_users tu ON ta.tg_user_id = tu.tg_user_id
      WHERE ta.task_id = ANY($1)
    `, [taskIds])

    const assigneeNamesByTask = buildAssigneeNamesMap(assigneeRows)

    const { rows: settingsRows } = await pool.query(
      'SELECT * FROM task_notification_settings WHERE tg_user_id = $1',
      [tgUserId]
    )

    const s: UserSettings = settingsRows.length > 0
      ? {
          deadlineDays: settingsRows[0].deadline_days,
          startDateDays: settingsRows[0].start_date_days,
          notifyBeforeDeadline: settingsRows[0].notify_before_deadline,
          notifyBeforeStart: settingsRows[0].notify_before_start,
          notifyOnDeadline: settingsRows[0].notify_on_deadline,
          notifyOnStart: settingsRows[0].notify_on_start,
          notifyPastDeadline: settingsRows[0].notify_past_deadline,
          notifyPastStart: settingsRows[0].notify_past_start,
          skipInProgress: settingsRows[0].skip_in_progress,
        }
      : DEFAULT_SETTINGS

    const todayStr = toHelsinkiDate(new Date())
    const today = new Date(todayStr + 'T00:00:00')

    const blocks: string[] = []
    for (const row of rows) {
      const block = formatTaskBlock(row, s, assigneeNamesByTask.get(row.task_id) ?? [], today)
      if (block) blocks.push(block)
    }

    if (blocks.length === 0) {
      return res.status(200).json({ sent: false, message: 'No notifications to send based on current settings and dates' })
    }

    const message = blocks.join('\n\n')

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return res.status(200).json({ sent: false, error: 'TELEGRAM_BOT_TOKEN not configured', message, blockCount: blocks.length })
    }

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgUserId, text: message, parse_mode: 'HTML' }),
      })

      if (!tgRes.ok) {
        const body = await tgRes.text()
        return res.status(200).json({ sent: false, telegramStatus: tgRes.status, telegramError: body, message, blockCount: blocks.length })
      }

      return res.status(200).json({ sent: true, message, blockCount: blocks.length })
    } catch (err) {
      return res.status(200).json({ sent: false, error: err instanceof Error ? err.message : String(err), message, blockCount: blocks.length })
    }
  } catch (err) {
    console.error('[notify-test] failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
