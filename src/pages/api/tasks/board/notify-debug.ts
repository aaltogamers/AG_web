import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'

type UserSettings = {
  deadlineDays: number
  startDateDays: number
  notifyBeforeDeadline: boolean
  notifyBeforeStart: boolean
  notifyOnDeadline: boolean
  notifyOnStart: boolean
  notifyPastDeadline: boolean
  notifyPastStart: boolean
  skipInProgress: boolean
}

const DEFAULT_SETTINGS: UserSettings = {
  deadlineDays: 5,
  startDateDays: 0,
  notifyBeforeDeadline: true,
  notifyBeforeStart: true,
  notifyOnDeadline: true,
  notifyOnStart: true,
  notifyPastDeadline: true,
  notifyPastStart: true,
  skipInProgress: false,
}

function toHelsinkiDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

type DebugNotification = {
  taskName: string
  type: 'deadline' | 'start_time'
  date: string
  diffDays: number
  wouldNotifyToday: boolean
  reason: string
  firstNotificationDate: string | null
  notificationDates: string[]
}

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
    const { rows } = await pool.query<{
      task_id: string
      name: string
      state: string
      deadline: Date | null
      start_time: Date | null
    }>(`
      SELECT t.id AS task_id, t.name, t.state, t.deadline, t.start_time
      FROM tasks t
      JOIN task_assignees ta ON ta.task_id = t.id
      WHERE t.state != 'done'
        AND ta.tg_user_id = $1
        AND (t.deadline IS NOT NULL OR t.start_time IS NOT NULL)
      ORDER BY t.id
    `, [tgUserId])

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

    const formatDate = (d: Date) => toHelsinkiDate(d)
    const todayStr = toHelsinkiDate(new Date())
    const today = new Date(todayStr + 'T00:00:00')

    const notifications: DebugNotification[] = []

    for (const row of rows) {
      const skippedInProgress = s.skipInProgress && row.state === 'in_progress'

      if (row.deadline) {
        const deadlineDate = new Date(toHelsinkiDate(row.deadline) + 'T00:00:00')
        const diffDays = Math.round(
          (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )

        let wouldNotify = false
        let reason: string

        if (skippedInProgress) {
          reason = 'Skipped — task is in_progress and skipInProgress is enabled'
        } else if (diffDays < 0) {
          wouldNotify = s.notifyPastDeadline
          reason = wouldNotify
            ? `Overdue by ${-diffDays} day(s) — notifyPastDeadline is ON`
            : `Overdue by ${-diffDays} day(s) — notifyPastDeadline is OFF`
        } else if (diffDays === 0) {
          wouldNotify = s.notifyOnDeadline
          reason = wouldNotify
            ? 'Due today — notifyOnDeadline is ON'
            : 'Due today — notifyOnDeadline is OFF'
        } else if (diffDays <= s.deadlineDays) {
          wouldNotify = s.notifyBeforeDeadline
          reason = wouldNotify
            ? `Due in ${diffDays} day(s), within ${s.deadlineDays}-day window — notifyBeforeDeadline is ON`
            : `Due in ${diffDays} day(s), within ${s.deadlineDays}-day window — notifyBeforeDeadline is OFF`
        } else {
          reason = `Due in ${diffDays} day(s), outside ${s.deadlineDays}-day window — no notification yet`
        }

        const notificationDates: string[] = []
        let firstNotificationDate: string | null = null

        if (!skippedInProgress) {
          if (s.notifyBeforeDeadline && diffDays > 0) {
            const startDay = addDays(deadlineDate, -s.deadlineDays)
            const from = startDay > today ? startDay : today
            const to = addDays(deadlineDate, -1)
            for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
              notificationDates.push(formatDate(d))
            }
          }
          if (s.notifyOnDeadline) {
            notificationDates.push(formatDate(deadlineDate) + ' (deadline day)')
          }
          if (s.notifyPastDeadline && diffDays <= 0) {
            notificationDates.push(formatDate(today) + ' (overdue — daily)')
          }

          if (notificationDates.length > 0) {
            if (s.notifyBeforeDeadline && s.deadlineDays > 0) {
              firstNotificationDate = formatDate(addDays(deadlineDate, -s.deadlineDays))
            } else if (s.notifyOnDeadline) {
              firstNotificationDate = formatDate(deadlineDate)
            }
          }
        }

        notifications.push({
          taskName: row.name,
          type: 'deadline',
          date: formatDate(row.deadline),
          diffDays,
          wouldNotifyToday: wouldNotify,
          reason,
          firstNotificationDate,
          notificationDates,
        })
      }

      if (row.start_time) {
        const startDate = new Date(toHelsinkiDate(row.start_time) + 'T00:00:00')
        const diffDays = Math.round(
          (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )

        let wouldNotify = false
        let reason: string

        if (skippedInProgress) {
          reason = 'Skipped — task is in_progress and skipInProgress is enabled'
        } else if (diffDays < 0) {
          wouldNotify = s.notifyPastStart
          reason = wouldNotify
            ? `Started ${-diffDays} day(s) ago — notifyPastStart is ON`
            : `Started ${-diffDays} day(s) ago — notifyPastStart is OFF`
        } else if (diffDays === 0) {
          wouldNotify = s.notifyOnStart
          reason = wouldNotify
            ? 'Starts today — notifyOnStart is ON'
            : 'Starts today — notifyOnStart is OFF'
        } else if (diffDays <= s.startDateDays) {
          wouldNotify = s.notifyBeforeStart
          reason = wouldNotify
            ? `Starts in ${diffDays} day(s), within ${s.startDateDays}-day window — notifyBeforeStart is ON`
            : `Starts in ${diffDays} day(s), within ${s.startDateDays}-day window — notifyBeforeStart is OFF`
        } else {
          reason = `Starts in ${diffDays} day(s), outside ${s.startDateDays}-day window — no notification yet`
        }

        const notificationDates: string[] = []
        let firstNotificationDate: string | null = null

        if (!skippedInProgress) {
          if (s.notifyBeforeStart && diffDays > 0) {
            const startDay = addDays(startDate, -s.startDateDays)
            const from = startDay > today ? startDay : today
            const to = addDays(startDate, -1)
            for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
              notificationDates.push(formatDate(d))
            }
          }
          if (s.notifyOnStart) {
            notificationDates.push(formatDate(startDate) + ' (start day)')
          }
          if (s.notifyPastStart && diffDays <= 0) {
            notificationDates.push(formatDate(today) + ' (past start — daily)')
          }

          if (notificationDates.length > 0) {
            if (s.notifyBeforeStart && s.startDateDays > 0) {
              firstNotificationDate = formatDate(addDays(startDate, -s.startDateDays))
            } else if (s.notifyOnStart) {
              firstNotificationDate = formatDate(startDate)
            }
          }
        }

        notifications.push({
          taskName: row.name,
          type: 'start_time',
          date: formatDate(row.start_time),
          diffDays,
          wouldNotifyToday: wouldNotify,
          reason,
          firstNotificationDate,
          notificationDates,
        })
      }
    }

    return res.status(200).json({
      tgUserId,
      today: todayStr,
      notificationTime: '10:00 Europe/Helsinki',
      settings: s,
      tasks: notifications,
      wouldSendToday: notifications.some((n) => n.wouldNotifyToday),
    })
  } catch (err) {
    console.error('[notify-debug] failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
