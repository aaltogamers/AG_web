import { LYCHEE_BASE_URL } from './utils/constants'

const PING_INTERVAL_MS = 10 * 60 * 1000

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

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    setInterval(pingImageServer, PING_INTERVAL_MS)
    console.log('[image-ping] Monitoring started — pinging every 10 minutes')
  }
}
