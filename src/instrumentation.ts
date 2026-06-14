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

async function checkDailyNotifications(): Promise<void> {
  const now = new Date()
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
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
    const { default: pool } = await import('./utils/db_pg')
    const { sendTelegramDM } = await import('./utils/telegram')

    const { rows } = await pool.query<{
      task_id: string
      name: string
      deadline: Date | null
      start_time: Date | null
      tg_user_id: string
    }>(`
      SELECT t.id AS task_id, t.name, t.deadline, t.start_time,
             ta.tg_user_id
      FROM tasks t
      JOIN task_assignees ta ON ta.task_id = t.id
      WHERE t.state != 'done'
        AND (
          (t.deadline IS NOT NULL
           AND t.deadline <= (NOW() AT TIME ZONE 'Europe/Helsinki' + INTERVAL '5 days'))
          OR
          (t.start_time IS NOT NULL
           AND (t.start_time AT TIME ZONE 'Europe/Helsinki')::date
               = (NOW() AT TIME ZONE 'Europe/Helsinki')::date)
        )
      ORDER BY t.id
    `)

    if (rows.length === 0) return

    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

    const byUser = new Map<string, string[]>()
    for (const row of rows) {
      if (!byUser.has(row.tg_user_id)) byUser.set(row.tg_user_id, [])
      const lines = byUser.get(row.tg_user_id)!
      const today = new Date(todayStr + 'T00:00:00')

      if (row.start_time) {
        const startDate = new Date(
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Helsinki',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(row.start_time)
        )
        if (startDate.getTime() === today.getTime()) {
          lines.push(`🗓 <b>${row.name}</b> — starts today`)
        }
      }

      if (row.deadline) {
        const deadlineDate = new Date(
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Helsinki',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(row.deadline)
        )
        const diffDays = Math.round(
          (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        let urgency: string
        if (diffDays < 0) urgency = '(overdue!)'
        else if (diffDays === 0) urgency = '(today!)'
        else if (diffDays === 1) urgency = '(tomorrow)'
        else urgency = `(in ${diffDays} days)`

        lines.push(`📅 <b>${row.name}</b> — due ${formatDate(row.deadline)} ${urgency}`)
      }
    }

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
