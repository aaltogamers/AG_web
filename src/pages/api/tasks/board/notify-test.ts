import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../utils/db_pg'
import { sendTelegramDM } from '../../../../utils/telegram'

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const tgUserId = req.query.tgUserId as string
  if (!tgUserId) return res.status(400).json({ error: 'tgUserId is required' })

  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

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

    if (rows.length === 0) {
      return res.status(200).json({ sent: false, message: 'No tasks with dates assigned to this user' })
    }

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

    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const todayStr = toHelsinkiDate(new Date())
    const today = new Date(todayStr + 'T00:00:00')

    const lines: string[] = []
    for (const row of rows) {
      if (s.skipInProgress && row.state === 'in_progress') continue

      if (row.deadline) {
        const deadlineDate = new Date(toHelsinkiDate(row.deadline) + 'T00:00:00')
        const diffDays = Math.round(
          (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        let shouldNotify = false
        if (diffDays < 0) shouldNotify = s.notifyPastDeadline
        else if (diffDays === 0) shouldNotify = s.notifyOnDeadline
        else if (diffDays <= s.deadlineDays) shouldNotify = s.notifyBeforeDeadline

        if (shouldNotify) {
          let urgency: string
          if (diffDays < 0) urgency = '(overdue!)'
          else if (diffDays === 0) urgency = '(today!)'
          else if (diffDays === 1) urgency = '(tomorrow)'
          else urgency = `(in ${diffDays} days)`

          lines.push(`📅 <b>${row.name}</b> — due ${formatDate(row.deadline)} ${urgency}`)
        }
      }

      if (row.start_time) {
        const startDate = new Date(toHelsinkiDate(row.start_time) + 'T00:00:00')
        const diffDays = Math.round(
          (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        let shouldNotify = false
        if (diffDays < 0) shouldNotify = s.notifyPastStart
        else if (diffDays === 0) shouldNotify = s.notifyOnStart
        else if (diffDays <= s.startDateDays) shouldNotify = s.notifyBeforeStart

        if (shouldNotify) {
          let label: string
          if (diffDays < 0) label = `started ${-diffDays} day${diffDays === -1 ? '' : 's'} ago`
          else if (diffDays === 0) label = 'starts today'
          else if (diffDays === 1) label = 'starts tomorrow'
          else label = `starts in ${diffDays} days`

          lines.push(`🗓 <b>${row.name}</b> — ${label}`)
        }
      }
    }

    if (lines.length === 0) {
      return res.status(200).json({ sent: false, message: 'No notifications to send based on current settings and dates' })
    }

    const message = `🧪 <b>TEST — Daily task reminder</b>\n\n${lines.join('\n')}`
    const sent = await sendTelegramDM(tgUserId, message)

    return res.status(200).json({ sent, message, lineCount: lines.length })
  } catch (err) {
    console.error('[notify-test] failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
