import {
  type UserSettings,
  type AssigneeRow,
  type TaskNotificationRow,
  DEFAULT_SETTINGS,
  toHelsinkiDate,
  buildAssigneeNamesMap,
  formatTaskBlock,
} from './utils/taskNotifications'

const DAILY_CHECK_INTERVAL_MS = 60 * 1000
let lastDailyRunDate: string | null = null

async function checkDailyNotifications(): Promise<void> {
  const now = new Date()
  const todayStr = toHelsinkiDate(now)
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Helsinki',
      hour: 'numeric',
      hour12: false,
    }).format(now)
  )

  if (hour !== 19 || lastDailyRunDate === todayStr) return
  lastDailyRunDate = todayStr

  try {
    const { default: pool } = await import('./utils/db_pg')
    const { sendTelegramDM } = await import('./utils/telegram')

    const { rows } = await pool.query<TaskNotificationRow & { tg_user_id: string }>(`
      SELECT t.id AS task_id, t.name, t.description, t.state, t.deadline, t.start_time,
             ta.tg_user_id
      FROM tasks t
      JOIN task_assignees ta ON ta.task_id = t.id
      WHERE t.state != 'done'
        AND (t.deadline IS NOT NULL OR t.start_time IS NOT NULL)
      ORDER BY t.id
    `)

    if (rows.length === 0) return

    const userIds = [...new Set(rows.map((r) => r.tg_user_id))]
    const { rows: settingsRows } = await pool.query<{
      tg_user_id: string
      deadline_days: number
      start_date_days: number
      notify_before_deadline: boolean
      notify_before_start: boolean
      notify_on_deadline: boolean
      notify_on_start: boolean
      notify_past_deadline: boolean
      notify_past_start: boolean
      skip_in_progress: boolean
    }>(
      `SELECT * FROM task_notification_settings
       WHERE tg_user_id = ANY($1)`,
      [userIds]
    )

    const settingsMap = new Map<string, UserSettings>()
    for (const s of settingsRows) {
      settingsMap.set(s.tg_user_id, {
        deadlineDays: s.deadline_days,
        startDateDays: s.start_date_days,
        notifyBeforeDeadline: s.notify_before_deadline,
        notifyBeforeStart: s.notify_before_start,
        notifyOnDeadline: s.notify_on_deadline,
        notifyOnStart: s.notify_on_start,
        notifyPastDeadline: s.notify_past_deadline,
        notifyPastStart: s.notify_past_start,
        skipInProgress: s.skip_in_progress,
      })
    }

    const today = new Date(todayStr + 'T00:00:00')

    const taskIds = [...new Set(rows.map((r) => r.task_id))]
    const { rows: assigneeRows } = await pool.query<AssigneeRow>(
      `
      SELECT ta.task_id, ta.tg_user_name,
             tu.first_name, tu.last_name
      FROM task_assignees ta
      LEFT JOIN tg_users tu ON ta.tg_user_id = tu.tg_user_id
      WHERE ta.task_id = ANY($1)
    `,
      [taskIds]
    )

    const assigneeNamesByTask = buildAssigneeNamesMap(assigneeRows)

    const byUser = new Map<string, string[]>()
    for (const row of rows) {
      const s = settingsMap.get(row.tg_user_id) ?? DEFAULT_SETTINGS
      const block = formatTaskBlock(row, s, assigneeNamesByTask.get(row.task_id) ?? [], today)
      if (block) {
        if (!byUser.has(row.tg_user_id)) byUser.set(row.tg_user_id, [])
        byUser.get(row.tg_user_id)!.push(block)
      }
    }

    if (byUser.size === 0) return

    const promises = [...byUser.entries()].map(([userId, blocks]) => {
      const message = blocks.join('\n\n')
      return sendTelegramDM(userId, message)
    })
    await Promise.allSettled(promises)

    console.log(`[task-notify] Sent daily reminders to ${byUser.size} user(s)`)
  } catch (err) {
    console.error('[task-notify] Daily notification check failed:', err)
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    setInterval(checkDailyNotifications, DAILY_CHECK_INTERVAL_MS)
    console.log('[task-notify] Daily notification check started — checking every 60 seconds')
  }
}
