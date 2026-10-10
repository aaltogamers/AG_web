// Posts bot API calls. The task board bot (src/utils/telegram.ts) is separate.
import type { LoadedImage } from './media'
import type { TelegramChannelConfig } from './types'

export class TelegramError extends Error {
  constructor(
    message: string,
    // Telegram's `retry_after` on 429, in seconds
    public retryAfter?: number,
    public status?: number
  ) {
    super(message)
  }
}

const token = () => {
  const value = process.env.TELEGRAM_POSTS_BOT_TOKEN
  if (!value) throw new TelegramError('TELEGRAM_POSTS_BOT_TOKEN is not set')
  return value
}

export const isTelegramConfigured = () => !!process.env.TELEGRAM_POSTS_BOT_TOKEN

type TelegramResponse<T> = {
  ok: boolean
  result?: T
  description?: string
  error_code?: number
  parameters?: { retry_after?: number }
}

const handle = async <T>(res: Response): Promise<T> => {
  const body = (await res.json().catch(() => ({}))) as TelegramResponse<T>
  if (!body.ok) {
    throw new TelegramError(
      `Telegram: ${body.description ?? `HTTP ${res.status}`}`,
      body.parameters?.retry_after,
      body.error_code ?? res.status
    )
  }
  return body.result as T
}

export const tgCall = async <T = unknown>(method: string, payload: Record<string, unknown>) =>
  handle<T>(
    await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  )

const tgUpload = async <T = unknown>(
  method: string,
  payload: Record<string, unknown>,
  files: { field: string; image: LoadedImage }[]
) => {
  const form = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    form.append(key, typeof value === 'string' ? value : JSON.stringify(value))
  })
  files.forEach(({ field, image }) =>
    form.append(field, new Blob([new Uint8Array(image.data)], { type: image.contentType }), image.filename)
  )
  return handle<T>(
    await fetch(`https://api.telegram.org/bot${token()}/${method}`, { method: 'POST', body: form })
  )
}

export type TgMessage = { message_id: number; chat: { id: number } }

export type InlineButton = { text: string; callback_data?: string; url?: string }

const target = (chatId: string, threadId?: string) => ({
  chat_id: chatId,
  ...(threadId && { message_thread_id: Number(threadId) }),
})

export const sendTelegramMessage = (
  chatId: string,
  threadId: string | undefined,
  html: string,
  options: { buttons?: InlineButton[][]; forceReply?: boolean; replyTo?: number } = {}
) =>
  tgCall<TgMessage>('sendMessage', {
    ...target(chatId, threadId),
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(options.buttons && { reply_markup: { inline_keyboard: options.buttons } }),
    ...(options.forceReply && { reply_markup: { force_reply: true, selective: true } }),
    ...(options.replyTo && { reply_parameters: { message_id: options.replyTo } }),
  })

export const editTelegramMessage = (
  chatId: string,
  messageId: number,
  html: string,
  buttons?: InlineButton[][]
) =>
  tgCall('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: buttons ?? [] },
  }).catch((err) => {
    // Editing to the same text is not an error for us
    if (!(err instanceof TelegramError) || !/not modified/.test(err.message)) throw err
  })

export const answerCallback = (callbackQueryId: string, text: string) =>
  tgCall('answerCallbackQuery', { callback_query_id: callbackQueryId, text }).catch((err) =>
    console.warn('[posts-bot] answerCallbackQuery failed:', err)
  )

// Sends images (as a photo or an album) and returns the messages' ids
const sendImages = async (
  chatId: string,
  threadId: string | undefined,
  images: LoadedImage[],
  captionHtml?: string
): Promise<number[]> => {
  const caption = captionHtml ? { caption: captionHtml, parse_mode: 'HTML' } : {}
  if (images.length === 1) {
    const msg = await tgUpload<TgMessage>('sendPhoto', { ...target(chatId, threadId), ...caption }, [
      { field: 'photo', image: images[0] },
    ])
    return [msg.message_id]
  }
  const media = images.map((_, i) => ({
    type: 'photo',
    media: `attach://photo${i}`,
    ...(i === 0 && caption),
  }))
  const msgs = await tgUpload<TgMessage[]>(
    'sendMediaGroup',
    { ...target(chatId, threadId), media },
    images.map((image, i) => ({ field: `photo${i}`, image }))
  )
  return msgs.map((m) => m.message_id)
}

// Sends a post to a channel: the images with the text as their caption, or
// only the text. The renderer keeps captions within TELEGRAM_CAPTION_LIMIT.
export const sendToTelegramChannel = async (
  config: TelegramChannelConfig,
  html: string,
  images: LoadedImage[]
): Promise<string> => {
  const { chatId, threadId } = config
  if (images.length) {
    return (await sendImages(chatId, threadId, images, html || undefined)).join(',')
  }
  const msg = await tgCall<TgMessage>('sendMessage', {
    ...target(chatId, threadId),
    text: html,
    parse_mode: 'HTML',
  })
  return String(msg.message_id)
}

// For the review topic: the post's images once, before the channel texts
export const sendReviewImages = (chatId: string, threadId: string | undefined, images: LoadedImage[]) =>
  sendImages(chatId, threadId, images)

export const setPostsWebhook = (url: string) => {
  const secret = process.env.TELEGRAM_POSTS_WEBHOOK_SECRET
  if (!secret) throw new TelegramError('TELEGRAM_POSTS_WEBHOOK_SECRET is not set')
  return tgCall('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'channel_post', 'callback_query', 'my_chat_member'],
  })
}

export const getPostsBotInfo = async () => {
  const [me, webhook] = await Promise.all([
    tgCall<{ id: number; username: string; first_name: string }>('getMe', {}),
    tgCall<{
      url: string
      last_error_message?: string
      last_error_date?: number
      pending_update_count: number
    }>('getWebhookInfo', {}),
  ])
  // Telegram keeps the last error after later updates succeed
  const isFailing = !!webhook.last_error_message && webhook.pending_update_count > 0
  return {
    username: me.username,
    webhookUrl: webhook.url,
    webhookError: isFailing ? (webhook.last_error_message ?? null) : null,
    pendingUpdates: webhook.pending_update_count,
    lastError:
      webhook.last_error_message && webhook.last_error_date
        ? {
            message: webhook.last_error_message,
            at: new Date(webhook.last_error_date * 1000).toISOString(),
          }
        : null,
  }
}

export const escapeTelegramHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
