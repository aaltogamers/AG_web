import type { NextApiRequest, NextApiResponse } from 'next'
import { timingSafeEqualStr } from '../../../utils/adminSession'
import { AgentError } from '../../../utils/agentApi'
import { getHeader } from '../../../utils/apiUtils'
import { ensureMigrated } from '../../../utils/db_pg'
import moment from 'moment-timezone'
import { EVENT_TIMEZONE } from '../../../utils/eventUtils'
import {
  forgetKnownChat,
  getPost,
  getSettings,
  isApprover,
  markTargetForwarded,
  saveSettings,
  upsertKnownChat,
} from '../../../utils/postStore'
import { approvePost, rejectPost, releaseHeldPost } from '../../../utils/social/actions'
import {
  answerCallback,
  editTelegramMessage,
  escapeTelegramHtml as esc,
  sendTelegramMessage,
  tgCall,
} from '../../../utils/social/telegram'

// Posts bot webhook: review buttons, /register, /review_here and
// the chats the bot is added to

type TgUser = { id: number; first_name: string; last_name?: string; username?: string }
type TgChat = { id: number; type: string; title?: string; first_name?: string }
type TgEntity = { type: string; offset: number; length: number }
type TgMessage = {
  message_id: number
  chat: TgChat
  from?: TgUser
  text?: string
  entities?: TgEntity[]
  message_thread_id?: number
  is_topic_message?: boolean
  reply_to_message?: TgMessage & { forum_topic_created?: { name: string } }
}
type Update = {
  message?: TgMessage
  channel_post?: TgMessage
  callback_query?: {
    id: string
    from: TgUser
    data?: string
    message?: TgMessage
  }
  my_chat_member?: {
    chat: TgChat
    new_chat_member: { status: string }
  }
}

const actorOf = (user: TgUser) => `tg:${user.id}` as const

const errorText = (err: unknown) =>
  err instanceof AgentError ? err.message : 'Something went wrong, see the server log'

// Bold texts of a message as HTML, enough for the forwarding request
const boldHtml = (msg: TgMessage) => {
  const text = msg.text ?? ''
  let html = ''
  let at = 0
  for (const e of (msg.entities ?? []).filter((e) => e.type === 'bold')) {
    html += `${esc(text.slice(at, e.offset))}<b>${esc(text.slice(e.offset, e.offset + e.length))}</b>`
    at = e.offset + e.length
  }
  return html + esc(text.slice(at))
}

// "✅ Forwarded" under a message to forward by hand. Anyone in the review topic can press it.
const handleForwarded = async (query: NonNullable<Update['callback_query']>, targetId: string) => {
  const name = [query.from.first_name, query.from.last_name].filter(Boolean).join(' ')
  if (!(await markTargetForwarded(targetId, name))) return answerCallback(query.id, 'Already marked as forwarded')
  if (query.message) {
    const note = `✅ <b>Forwarded by ${esc(name)}</b> at ${moment().tz(EVENT_TIMEZONE).format('HH:mm')}`
    await editTelegramMessage(String(query.message.chat.id), query.message.message_id, `${boldHtml(query.message)}\n\n${note}`).catch(
      (err) => console.warn('[posts-webhook] editing the forwarding request failed:', err)
    )
  }
  return answerCallback(query.id, 'Marked as forwarded')
}

const handleCallback = async (query: NonNullable<Update['callback_query']>) => {
  const forwarded = /^fwd:(\d+)$/.exec(query.data ?? '')
  if (forwarded) return handleForwarded(query, forwarded[1])
  const match = /^post:(\d+):(\d+):(approve|reject|retry|send_anyway)$/.exec(query.data ?? '')
  if (!match) return answerCallback(query.id, 'Unknown button')
  const [, postId, versionText, action] = match
  const version = Number(versionText)

  const settings = await getSettings()
  if (!isApprover(settings, query.from.id)) return answerCallback(query.id, 'Not allowed')
  const post = await getPost(postId)
  if (!post) return answerCallback(query.id, 'The post no longer exists')
  if (post.version !== version) return answerCallback(query.id, 'Out of date: the post has been edited since')

  const actor = actorOf(query.from)
  try {
    if (action === 'approve') {
      await approvePost(postId, version, actor)
      return answerCallback(query.id, 'Approved')
    }
    if (action === 'reject') {
      await rejectPost(postId, version, actor)
      return answerCallback(query.id, 'Rejected')
    }
    await releaseHeldPost(postId, version, actor, action === 'retry' ? 'retry' : 'send_anyway')
    return answerCallback(query.id, action === 'retry' ? 'Retrying' : 'Sending without the website change')
  } catch (err) {
    if (!(err instanceof AgentError)) console.error('[posts-webhook] button failed:', err)
    return answerCallback(query.id, errorText(err).slice(0, 190))
  }
}

const reply = (msg: TgMessage, html: string) =>
  sendTelegramMessage(
    String(msg.chat.id),
    msg.is_topic_message && msg.message_thread_id ? String(msg.message_thread_id) : undefined,
    html,
    { replyTo: msg.message_id }
  ).catch((err) => console.warn('[posts-webhook] reply failed:', err))

const chatTitle = (msg: TgMessage) => {
  const base = msg.chat.title ?? msg.chat.first_name ?? String(msg.chat.id)
  const topic = msg.is_topic_message ? msg.reply_to_message?.forum_topic_created?.name : undefined
  return topic ? `${base} / ${topic}` : base
}

const handleCommand = async (msg: TgMessage, command: string, isChannelPost: boolean) => {
  const settings = await getSettings()
  const byApprover = !!msg.from && isApprover(settings, msg.from.id)
  // /register only lists the chat in the settings dropdowns, so channel admins
  // can use it. /review_here sends every review to the chat, so only approvers
  // can, which rules out channels: channel posts don't say who sent them.
  if (!byApprover && (command === 'review_here' || !isChannelPost)) {
    if (isChannelPost) return
    return reply(msg, 'Not allowed: only approvers (set in the posts settings on the website) can use this.')
  }
  const chatId = String(msg.chat.id)
  const threadId = msg.is_topic_message && msg.message_thread_id ? String(msg.message_thread_id) : ''
  const title = chatTitle(msg)
  await upsertKnownChat({ chatId, threadId, title, type: msg.chat.type })

  if (command === 'review_here') {
    await saveSettings({ telegram: { ...settings.telegram, reviewChatId: chatId, reviewThreadId: threadId } })
    return reply(msg, `✅ Reviews of posts now go here (${esc(title)}).`)
  }
  if (isChannelPost) {
    // Don't leave the command visible to the channel's subscribers
    await tgCall('deleteMessage', { chat_id: chatId, message_id: msg.message_id }).catch(() => undefined)
    return
  }
  return reply(
    msg,
    `✅ Registered <b>${esc(title)}</b> (chat ${chatId}${threadId ? `, topic ${threadId}` : ''}). Add it as a channel in the posts settings on the website.`
  )
}

const handleMessage = async (msg: TgMessage, isChannelPost: boolean) => {
  const command = /^\/(register|review_here)(@\w+)?(\s|$)/.exec(msg.text ?? '')?.[1]
  if (command) return handleCommand(msg, command, isChannelPost)
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const secret = process.env.TELEGRAM_POSTS_WEBHOOK_SECRET
  const given = getHeader(req, 'x-telegram-bot-api-secret-token')
  if (!secret || !given || !timingSafeEqualStr(given, secret)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await ensureMigrated()
    const update = req.body as Update
    if (update.callback_query) await handleCallback(update.callback_query)
    else if (update.message) await handleMessage(update.message, false)
    else if (update.channel_post) await handleMessage(update.channel_post, true)
    else if (update.my_chat_member) {
      const { chat, new_chat_member: member } = update.my_chat_member
      if (member.status === 'left' || member.status === 'kicked') {
        await forgetKnownChat(String(chat.id))
      } else if (chat.type !== 'private') {
        await upsertKnownChat({
          chatId: String(chat.id),
          threadId: '',
          title: chat.title ?? String(chat.id),
          type: chat.type,
        })
      }
    }
  } catch (err) {
    console.error('[posts-webhook] update failed:', err)
  }
  // Always 200, so Telegram doesn't resend the update
  return res.status(200).json({ ok: true })
}

export default handler
