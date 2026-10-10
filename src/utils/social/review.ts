// Review topic messages: posts with Approve / Reject buttons, and failures with
// Retry / Send anyway buttons.
import moment from 'moment-timezone'
import { EVENT_TIMEZONE } from '../eventUtils'
import {
  deletePreviewMessage,
  describeActor,
  getOpenPreviewMessages,
  getSettings,
  savePreviewMessage,
  websiteRunAt,
} from '../postStore'
import { loadImage } from './media'
import { buildPreview, previewErrors } from './preview'
import { telegramLength, toTelegramHtml } from './render'
import {
  editTelegramMessage,
  escapeTelegramHtml as esc,
  type InlineButton,
  isTelegramConfigured,
  sendReviewImages,
  sendTelegramMessage,
} from './telegram'
import type { Platform, Post, PostPreview, RenderedText, SocialSettings } from './types'

const SHORT: Record<Platform, string> = { telegram: 'TG', discord: 'DC', instagram: 'IG' }

export const formatTime = (iso: string | null) =>
  iso ? moment(iso).tz(EVENT_TIMEZONE).format('ddd D.M. HH:mm') : 'no time'

export const postAdminUrl = (settings: SocialSettings, postId: string) =>
  `${settings.website.baseUrl}/admin/posts?id=${postId}`

const reviewTarget = (settings: SocialSettings) => {
  const { reviewChatId, reviewThreadId } = settings.telegram
  if (!reviewChatId || !isTelegramConfigured()) return null
  return { chatId: reviewChatId, threadId: reviewThreadId || undefined }
}

const callback = (post: Post, action: string) => `post:${post.id}:${post.version}:${action}`

const openButton = (settings: SocialSettings, post: Post): InlineButton => ({
  text: '✏️ Open on website',
  url: postAdminUrl(settings, post.id),
})

// Telegram's limit is 4096 characters; long texts are cut as plain text
const fit = (header: string, html: string) => {
  if (telegramLength(header + html) <= 4000) return header + html
  const plain = html.replace(/<[^>]+>/g, '')
  return `${header}${plain.slice(0, 3500)}… <i>(cut here in the review)</i>`
}

// A channel's text as Telegram can show it: Telegram channels exactly, the
// others approximately
const channelMessage = (post: Post, t: RenderedText) => {
  const header =
    `🔍 <b>Review → ${SHORT[t.platform]}: ${esc(t.channelName)}</b> · ${formatTime(t.sendAt)} · v${post.version}\n` +
    (t.platform !== 'telegram' ? `<i>Approximation; ${t.platform} formats it differently</i>\n` : '') +
    [...t.errors.map((e) => `❗ ${esc(e)}`), ...t.warnings.map((w) => `⚠️ ${esc(w)}`)]
      .map((line) => `${line}\n`)
      .join('') +
    '—————\n'
  const body =
    t.platform === 'telegram'
      ? t.text
      : t.platform === 'discord'
        ? toTelegramHtml(t.text)
        : esc(t.text)
  return fit(header, body)
}

const websiteMessage = (post: Post, preview: PostPreview) => {
  const w = preview.website
  if (!w) return null
  const what =
    w.kind === 'create_event'
      ? `create the event /events/${w.eventSlug ?? '…'}`
      : `change the event /events/${w.eventSlug}`
  const cut = (s: string) => (s.length > 300 ? `${s.slice(0, 300)}…` : s)
  const lines = [
    `🌐 <b>Website</b> · ${formatTime(w.runAt)} · v${post.version}: ${esc(what)}`,
    ...w.diff.map((d) =>
      w.kind === 'create_event'
        ? `<b>${esc(d.field)}</b>: ${esc(cut(d.to))}`
        : `<b>${esc(d.field)}</b>: ${esc(cut(d.from))} → ${esc(cut(d.to))}`
    ),
    ...w.forms.map(
      (f) =>
        `📝 Sign-up form ${esc(f.label)}: ${f.isNew ? 'new' : `changed, already has ${f.signups} sign-up(s)`}`
    ),
    ...w.errors.map((e) => `❗ ${esc(e)}`),
    ...w.warnings.map((e) => `⚠️ ${esc(e)}`),
  ]
  return fit('', lines.join('\n'))
}

const summaryText = (
  post: Post,
  preview: PostPreview,
  settings: SocialSettings,
  requestedBy: string,
  editedAfterApproval: boolean
) => {
  const errors = previewErrors(preview)
  const runAt = websiteRunAt(post, settings.website.leadMinutes)
  return [
    `📝 <b>Post #${post.id}: ${esc(post.title || 'Untitled')}</b> · v${post.version}`,
    ...(editedAfterApproval ? ['⚠️ <b>Edited after approval</b>; it is off the schedule until approved again'] : []),
    `Approval requested by ${esc(describeActor(requestedBy, settings))}`,
    ...preview.texts.map((t) => `• ${SHORT[t.platform]}: ${esc(t.channelName)} · ${formatTime(t.sendAt)}`),
    ...(post.websiteChange ? [`• Website · ${formatTime(runAt)}`] : []),
    ...(errors.length
      ? ['', `❗ <b>Can't be approved until fixed:</b>`, ...errors.map((e) => `❗ ${esc(e)}`)]
      : []),
  ].join('\n')
}

// Marks older review messages of the post as out of date, without buttons
export const closeOpenMessages = async (postId: string, note: string, onlyVersion?: number) => {
  const open = await getOpenPreviewMessages(postId)
  for (const msg of open.filter((m) => onlyVersion === undefined || m.version === onlyVersion)) {
    await editTelegramMessage(msg.chatId, msg.messageId, `${msg.text}\n\n${note}`).catch((err) =>
      console.warn('[posts-review] editing a review message failed:', err)
    )
    await deletePreviewMessage(msg.chatId, msg.messageId)
  }
}

// Sends the post to the review topic. Returns false if no review topic is set up.
export const sendReview = async (
  post: Post,
  { requestedBy, editedAfterApproval = false }: { requestedBy: string; editedAfterApproval?: boolean }
): Promise<boolean> => {
  const settings = await getSettings()
  const chat = reviewTarget(settings)
  if (!chat) return false
  await closeOpenMessages(post.id, `<i>Out of date: replaced by v${post.version}</i>`)

  const preview = await buildPreview(post)
  if (post.images.length) {
    const images = await Promise.all(post.images.map(loadImage)).catch(() => [])
    if (images.length) await sendReviewImages(chat.chatId, chat.threadId, images)
  }
  for (const text of preview.texts) {
    await sendTelegramMessage(chat.chatId, chat.threadId, channelMessage(post, text))
  }
  const website = websiteMessage(post, preview)
  if (website) await sendTelegramMessage(chat.chatId, chat.threadId, website)

  const text = summaryText(post, preview, settings, requestedBy, editedAfterApproval)
  const msg = await sendTelegramMessage(chat.chatId, chat.threadId, text, {
    buttons: [
      [
        { text: '✅ Approve', callback_data: callback(post, 'approve') },
        { text: '❌ Reject', callback_data: callback(post, 'reject') },
      ],
      [openButton(settings, post)],
    ],
  })
  await savePreviewMessage({
    postId: post.id,
    version: post.version,
    chatId: chat.chatId,
    messageId: msg.message_id,
    kind: 'summary',
    text,
  })
  return true
}

// After approval or rejection, on the website or in Telegram
export const announceDecision = async (post: Post, version: number, note: string) => {
  await closeOpenMessages(post.id, note, version).catch((err) =>
    console.error('[posts-review] closing review failed:', err)
  )
}

export const approvalNote = (post: Post, actor: string, settings: SocialSettings) => {
  const times = post.targets
    .filter((t) => t.status === 'pending')
    .map((t) => t.sendAt ?? post.sendAt)
    .filter((t): t is string => !!t)
    .sort()
  const runAt = websiteRunAt(post, settings.website.leadMinutes)
  const parts = [
    ...(post.websiteChange ? [`website ${formatTime(runAt)}`] : []),
    ...(times.length ? [`posts ${formatTime(times[0])}${times.length > 1 && times[times.length - 1] !== times[0] ? `–${formatTime(times[times.length - 1])}` : ''}`] : []),
  ]
  return `✅ <b>Approved by ${esc(describeActor(actor, settings))}</b> at ${moment().tz(EVENT_TIMEZONE).format('HH:mm')}${parts.length ? ` → ${parts.join(', ')}` : ''}`
}

// Reports a problem in the review topic, optionally with Retry / Send anyway buttons
export const sendNotice = async (
  post: Post,
  html: string,
  { heldButtons = false }: { heldButtons?: boolean } = {}
) => {
  const settings = await getSettings()
  const chat = reviewTarget(settings)
  if (!chat) {
    console.warn(`[posts-review] no review topic set up; post #${post.id}: ${html}`)
    return
  }
  const text = `📝 <b>Post #${post.id}: ${esc(post.title || 'Untitled')}</b> · v${post.version}\n${html}`
  const buttons: InlineButton[][] = [
    ...(heldButtons
      ? [
          [
            { text: '🔁 Retry', callback_data: callback(post, 'retry') },
            { text: '▶️ Send anyway', callback_data: callback(post, 'send_anyway') },
          ],
        ]
      : []),
    [openButton(settings, post)],
  ]
  try {
    const msg = await sendTelegramMessage(chat.chatId, chat.threadId, text, { buttons })
    if (heldButtons) {
      await savePreviewMessage({
        postId: post.id,
        version: post.version,
        chatId: chat.chatId,
        messageId: msg.message_id,
        kind: 'notice',
        text,
      })
    }
  } catch (err) {
    console.error('[posts-review] sending a notice failed:', err)
  }
}

// A message to the review topic that isn't about one post
export const sendReviewText = async (html: string) => {
  const chat = reviewTarget(await getSettings())
  if (!chat) {
    console.warn(`[posts-review] no review topic set up: ${html}`)
    return
  }
  await sendTelegramMessage(chat.chatId, chat.threadId, html).catch((err) =>
    console.error('[posts-review] sending a message failed:', err)
  )
}
