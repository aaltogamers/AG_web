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
      signal: AbortSignal.timeout(30_000),
      redirect: 'manual',
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
      description: string | null
      state: string
      deadline: Date | null
      start_time: Date | null
      tg_user_id: string
    }>(`
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
    const { rows: assigneeRows } = await pool.query<{
      task_id: string
      tg_user_name: string
      first_name: string | null
      last_name: string | null
    }>(`
      SELECT ta.task_id, ta.tg_user_name,
             tu.first_name, tu.last_name
      FROM task_assignees ta
      LEFT JOIN tg_users tu ON ta.tg_user_id = tu.tg_user_id
      WHERE ta.task_id = ANY($1)
    `, [taskIds])

    const assigneeNamesByTask = new Map<string, string[]>()
    for (const a of assigneeRows) {
      const displayName = a.first_name
        ? `${a.first_name}${a.last_name ? ' ' + a.last_name : ''}`
        : a.tg_user_name
      if (!assigneeNamesByTask.has(a.task_id)) assigneeNamesByTask.set(a.task_id, [])
      assigneeNamesByTask.get(a.task_id)!.push(displayName)
    }

    const stateLabels: Record<string, string> = {
      todo: 'To Do',
      in_progress: 'In Progress',
      done: 'Done',
    }

    const formatDateShort = (d: Date): string => {
      const parts = toHelsinkiDate(d).split('-')
      return `${parts[2]}.${parts[1]}.`
    }

    const daysDiff = (d: Date): number => {
      const dateStr = new Date(toHelsinkiDate(d) + 'T00:00:00')
      return Math.round((dateStr.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    }

    const byUser = new Map<string, string[]>()
    for (const row of rows) {
      const s = settingsMap.get(row.tg_user_id) ?? DEFAULT_SETTINGS
      if (s.skipInProgress && row.state === 'in_progress') continue

      let deadlineShouldNotify = false
      let startShouldNotify = false
      const dlDiff = row.deadline ? daysDiff(row.deadline) : null
      const stDiff = row.start_time ? daysDiff(row.start_time) : null

      if (dlDiff !== null) {
        if (dlDiff < 0) deadlineShouldNotify = s.notifyPastDeadline
        else if (dlDiff === 0) deadlineShouldNotify = s.notifyOnDeadline
        else if (dlDiff <= s.deadlineDays) deadlineShouldNotify = s.notifyBeforeDeadline
      }

      if (stDiff !== null) {
        if (stDiff < 0) startShouldNotify = s.notifyPastStart
        else if (stDiff === 0) startShouldNotify = s.notifyOnStart
        else if (stDiff <= s.startDateDays) startShouldNotify = s.notifyBeforeStart
      }

      if (!deadlineShouldNotify && !startShouldNotify) continue

      const dateParts: string[] = []
      if (startShouldNotify && row.start_time) dateParts.push(`Start ${formatDateShort(row.start_time)}`)
      if (deadlineShouldNotify && row.deadline) dateParts.push(`DL. ${formatDateShort(row.deadline)}`)

      let icon = ''
      if ((dlDiff !== null && dlDiff < 0) || (stDiff !== null && stDiff < 0)) {
        icon = ' ❌'
      } else if ((dlDiff !== null && dlDiff === 0) || (stDiff !== null && stDiff === 0 && row.state === 'todo')) {
        icon = ' ⚠️'
      }

      const assigneeNames = assigneeNamesByTask.get(row.task_id) ?? []
      const blockLines = [
        `<b>${row.name}</b>`,
        `${dateParts.join(' · ')} (${stateLabels[row.state] || row.state})${icon}`,
        assigneeNames.join(', '),
      ]
      if (row.description) {
        blockLines.push('')
        blockLines.push(`<i>${row.description}</i>`)
      }

      if (!byUser.has(row.tg_user_id)) byUser.set(row.tg_user_id, [])
      byUser.get(row.tg_user_id)!.push(blockLines.join('\n'))
    }

    if (byUser.size === 0) return

    const promises = [...byUser.entries()].map(([userId, blocks]) => {
      const message = `⏰ <b>Daily task reminder</b>\n\n${blocks.join('\n\n')}`
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
