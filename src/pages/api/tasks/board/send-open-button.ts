import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const chatId = req.query.chatId as string | undefined
  const topicId = req.query.topicId as string | undefined
  if (!chatId) return res.status(400).json({ error: 'chatId is required' })

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' })

  const webAppUrl = `https://t.me/AG_Alvar_Aalto_Bot/tasks`

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: 'Open the tasks board in Telegram:',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Open Tasks App', url: webAppUrl }],
      ],
    },
  }

  if (topicId) {
    body.message_thread_id = topicId
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!tgRes.ok) {
      const error = await tgRes.text()
      return res.status(200).json({ sent: false, telegramStatus: tgRes.status, telegramError: error })
    }

    return res.status(200).json({ sent: true })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
