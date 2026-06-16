import { LYCHEE_BASE_URL } from './utils/constants'

const PING_INTERVAL_MS = 10 * 60 * 1000
const DAILY_CHECK_INTERVAL_MS = 60 * 1000
let lastDailyRunDate: string | null = null

async function sendTelegramAlert(error: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    console.error('[image-ping] Telegram credentials not configured, skipping alert')
    return
  }

  const text = `⚠️ images.aaltogamers.fi is down!\n\nError: ${error}`
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`

  const body: Record<string, string | number> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('[image-ping] Telegram API error:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[image-ping] Failed to send Telegram alert:', err)
  }
}

async function pingImageServer(): Promise<void> {
  try {
    const res = await fetch(LYCHEE_BASE_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.warn(`[image-ping] ${LYCHEE_BASE_URL} responded with status ${res.status}`)
      await sendTelegramAlert(`HTTP ${res.status}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[image-ping] ${LYCHEE_BASE_URL} unreachable: ${message}`)
    await sendTelegramAlert(message)
  }
}

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

  if (hour !== 10 || lastDailyRunDate === todayStr) return
  lastDailyRunDate = todayStr

  try {
    const { default: pool } = await import(/* webpackIgnore: true */ './utils/db_pg')
    const { sendTelegramDM } = await import(/* webpackIgnore: true */ './utils/telegram')

    const { rows } = await pool.query<{
      task_id: string
      name: string
      state: string
      deadline: Date | null
      start_time: Date | null
      tg_user_id: string
    }>(`
      SELECT t.id AS task_id, t.name, t.state, t.deadline, t.start_time,
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

    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const today = new Date(todayStr + 'T00:00:00')

    const byUser = new Map<string, string[]>()
    for (const row of rows) {
      const s = settingsMap.get(row.tg_user_id) ?? DEFAULT_SETTINGS
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

          if (!byUser.has(row.tg_user_id)) byUser.set(row.tg_user_id, [])
          byUser.get(row.tg_user_id)!.push(
            `📅 <b>${row.name}</b> — due ${formatDate(row.deadline)} ${urgency}`
          )
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

          if (!byUser.has(row.tg_user_id)) byUser.set(row.tg_user_id, [])
          byUser.get(row.tg_user_id)!.push(`🗓 <b>${row.name}</b> — ${label}`)
        }
      }
    }

    if (byUser.size === 0) return

    const promises = [...byUser.entries()].map(([userId, lines]) => {
      const message = `⏰ <b>Daily task reminder</b>\n\n${lines.join('\n')}`
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
    setInterval(pingImageServer, PING_INTERVAL_MS)
    console.log('[image-ping] Monitoring started — pinging every 10 minutes')

    setInterval(checkDailyNotifications, DAILY_CHECK_INTERVAL_MS)
    console.log('[task-notify] Daily notification check started — checking every 60 seconds')
  }
}
