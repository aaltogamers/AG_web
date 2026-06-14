export async function getTelegramChatTitle(chatId: string): Promise<string | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return null

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.result?.title ?? null
  } catch {
    return null
  }
}

export async function sendTelegramDM(tgUserId: string, text: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error('[tg-notify] TELEGRAM_BOT_TOKEN not configured')
    return false
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgUserId,
        text,
        parse_mode: 'HTML',
      }),
    })

    if (res.status === 403) {
      console.info(`[tg-notify] User ${tgUserId} has not started the bot, skipping`)
      return false
    }

    if (!res.ok) {
      console.error(`[tg-notify] Telegram API error for user ${tgUserId}:`, res.status, await res.text())
      return false
    }

    return true
  } catch (err) {
    console.error(`[tg-notify] Failed to send DM to ${tgUserId}:`, err)
    return false
  }
}
