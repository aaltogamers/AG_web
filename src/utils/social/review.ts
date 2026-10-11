// Review topic messages: posts with Approve / Reject buttons, failures with
// Retry / Send anyway buttons, and messages to forward by hand.
import moment from 'moment-timezone'
import { EVENT_TIMEZONE } from '../eventUtils'
import {
  deletePreviewMessage,
  describeActor,
  getOpenPreviewMessages,
  getSettings,
  type PreviewMessage,
  savePreviewMessage,
  websiteRunAt,
} from '../postStore'
import { loadImage, type LoadedImage } from './media'
import { buildPreview, previewErrors } from './preview'
import { showDiscordRoles, telegramLength, toTelegramHtml } from './render'
import {
  editTelegramMessage,
  escapeTelegramHtml as esc,
  type InlineButton,
  isTelegramConfigured,
  sendReviewImages,
  sendTelegramMessage,
  sendToTelegramChannel,
} from './telegram'
import type { Platform, Post, PostPreview, RenderedText, SocialSettings, WebsiteChangeTiming } from './types'

const PLATFORM: Record<Platform, string> = { telegram: '✈️ Telegram', discord: '💬 Discord', instagram: '📷 Instagram' }

export const formatTime = (iso: string | null) =>
  iso ? moment(iso).tz(EVENT_TIMEZONE).format('ddd D.M. HH:mm') : 'no time'

// When the website change runs, for the review messages
const websiteTime = (timing: WebsiteChangeTiming | undefined, runAt: string | null) =>
  timing === 'on_approval' ? 'when approved' : formatTime(runAt)

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

const toPlain = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

// Telegram's limit is 4096 characters; long texts are cut as plain text. Cut
// unescaped, so that an entity like &amp; isn't cut in half.
const fit = ({ header = '', html, footer = '' }: Message) => {
  if (telegramLength(header + html + footer) <= 4000) return header + html + footer
  const room = Math.max(500, 3500 - telegramLength(header + footer))
  return `${header}${esc(toPlain(html).slice(0, room))}… <i>(cut here in the review)</i>${footer}`
}

// A channel's text as Telegram can show it: Telegram channels exactly, the
// others approximately
const channelHtml = (t: RenderedText) =>
  t.platform === 'telegram'
    ? t.text
    : t.platform === 'discord'
      ? toTelegramHtml(showDiscordRoles(t.text, t.roleNames))
      : esc(t.text)

const channelLine = (t: RenderedText) =>
  `${PLATFORM[t.platform]} <b>${esc(t.channelName)}</b> · ${t.onApproval ? 'when approved' : formatTime(t.sendAt)}`

const LINE = '━━━━━━━━━━'

// A review message; only `html` is cut when it is too long
type Message = { header?: string; html: string; footer?: string }

// Top-level blocks of Telegram HTML: paragraphs, without cutting a quote or a
// code block in half
const htmlBlocks = (html: string) => {
  const blocks: string[] = []
  for (const part of html.split('\n\n')) {
    const prev = blocks[blocks.length - 1]
    const isOpen = (b: string) => (b.match(/<[a-z]/g) ?? []).length > (b.match(/<\//g) ?? []).length
    if (prev !== undefined && isOpen(prev)) blocks[blocks.length - 1] = `${prev}\n\n${part}`
    else blocks.push(part)
  }
  return blocks.filter((b) => b.trim())
}

const blockKey = (html: string) => toPlain(html).replace(/\s+/g, ' ').trim()

type TextGroup = { blocks: string[]; keys: string[]; channels: RenderedText[] }

// The longest run of blocks that every group has, as [start in each group, length]
const sharedRun = (groups: TextGroup[]): [number[], number] | null => {
  const [first, ...rest] = groups
  for (let len = first.keys.length; len > 0; len--) {
    for (let i = 0; i + len <= first.keys.length; i++) {
      const run = first.keys.slice(i, i + len).join('\n')
      const starts = rest.map((g) =>
        g.keys.findIndex((_, j) => j + len <= g.keys.length && g.keys.slice(j, j + len).join('\n') === run)
      )
      if (starts.every((j) => j >= 0)) return [[i, ...starts], len]
    }
  }
  return null
}

// The channels' texts in as few messages as possible, each headed by the
// channels it goes to. Texts that only differ in formatting count as the same,
// and are shown as the first channel's (Telegram's, if it has one). When the
// texts only differ at the start or the end, like in the footer or Discord's
// pings, the shared text is shown once, followed by each channel's own parts.
const channelMessages = (texts: RenderedText[]): Message[] => {
  const order: Platform[] = ['telegram', 'discord', 'instagram']
  const sorted = [...texts].sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform))
  const byText = new Map<string, TextGroup>()
  for (const t of sorted) {
    const blocks = htmlBlocks(channelHtml(t))
    const keys = blocks.map(blockKey)
    const group = byText.get(keys.join('\n'))
    if (group) group.channels.push(t)
    else byText.set(keys.join('\n'), { blocks, keys, channels: [t] })
  }
  const groups = [...byText.values()]
  const header = (g: TextGroup) => g.channels.map(channelLine).join('\n')
  const separate = () => groups.map((g) => ({ header: `${header(g)}\n${LINE}\n`, html: g.blocks.join('\n\n') }))
  if (groups.length < 2) return separate()

  // Only worth it when most of each text is shared
  const run = sharedRun(groups)
  if (!run || groups.some((g) => run[1] * 2 < g.keys.length)) return separate()
  const [starts, len] = run
  const shared = groups[0].blocks.slice(starts[0], starts[0] + len).join('\n\n')
  const parts = groups.map((g, i) => {
    const before = g.blocks.slice(0, starts[i]).join('\n\n')
    const after = g.blocks.slice(starts[i] + len).join('\n\n')
    return [
      header(g),
      ...(before ? [`<i>Starts with:</i>\n${before}`] : []),
      ...(after ? [`<i>Ends with:</i>\n${after}`] : []),
    ].join('\n')
  })
  return [{ html: [shared, ...parts].join(`\n\n${LINE}\n`) }]
}

const websiteMessage = (preview: PostPreview): Message | null => {
  const w = preview.website
  if (!w) return null
  const what =
    w.kind === 'create_event'
      ? `create the event /events/${w.eventSlug ?? '…'}`
      : `change the event /events/${w.eventSlug}`
  const cut = (s: string) => (s.length > 300 ? `${s.slice(0, 300)}…` : s)
  const lines = [
    `🌐 <b>Website</b> · ${websiteTime(w.timing, w.runAt)}: ${esc(what)}`,
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
  return { html: lines.join('\n') }
}

// What the review is and the post's title, at the top of the review
const titleText = (post: Post, editedAfterApproval: boolean) =>
  [
    'Post awaiting approval',
    `📝 <b>${esc(post.title || 'Untitled')}</b>`,
    ...(editedAfterApproval ? ['⚠️ <b>Edited after approval</b>; it is off the schedule until approved again'] : []),
  ].join('\n')

// What stops approving, at the end of the review
const errorsText = (preview: PostPreview) => {
  const errors = previewErrors(preview)
  return errors.length ? [`❗ <b>Can't be approved until fixed:</b>`, ...errors.map((e) => `❗ ${esc(e)}`)].join('\n') : ''
}

// Marks older review messages of the post as out of date, without buttons
export const closeOpenMessages = async (postId: string, note: string, onlyVersion?: number) => {
  const open = await getOpenPreviewMessages(postId)
  await closeMessages(
    open.filter((m) => onlyVersion === undefined || m.version === onlyVersion),
    note
  )
}

export const closeMessages = async (messages: PreviewMessage[], note: string) => {
  for (const msg of messages) {
    await editTelegramMessage(msg.chatId, msg.messageId, `${msg.text}\n\n${note}`).catch((err) =>
      console.warn('[posts-review] editing a review message failed:', err)
    )
    await deletePreviewMessage(msg.chatId, msg.messageId)
  }
}

// Sends the post to the review topic. Returns false if no review topic is set up.
export const sendReview = async (
  post: Post,
  { editedAfterApproval = false }: { editedAfterApproval?: boolean } = {}
): Promise<boolean> => {
  const settings = await getSettings()
  const chat = reviewTarget(settings)
  if (!chat) return false
  await closeOpenMessages(post.id, '<i>Out of date: replaced by a newer version</i>')

  const preview = await buildPreview(post)
  if (post.images.length) {
    const images = await Promise.all(post.images.map(loadImage)).catch(() => [])
    if (images.length) await sendReviewImages(chat.chatId, chat.threadId, images)
  }
  // The title goes on the first message, and the errors and the buttons on the last
  const website = websiteMessage(preview)
  const messages: Message[] = [...channelMessages(preview.texts), ...(website ? [website] : [])]
  if (!messages.length) messages.push({ html: '' })
  const title = titleText(post, editedAfterApproval)
  messages[0] = { ...messages[0], header: `${title}\n\n${messages[0].header ?? ''}` }
  const errors = errorsText(preview)
  const last = messages.length - 1
  if (errors) messages[last] = { ...messages[last], footer: `\n\n${errors}` }
  const texts = messages.map((m) => fit(m).trim())
  for (const text of texts.slice(0, -1)) await sendTelegramMessage(chat.chatId, chat.threadId, text)

  const text = texts[last]
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
    ...(post.websiteChange ? [`website ${post.websiteChange.timing === 'on_approval' ? 'now' : formatTime(runAt)}`] : []),
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
  const text = `📝 <b>${esc(post.title || 'Untitled')}</b>\n${html}`
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

// A channel the bot can't post to: sends its message to the review topic, with
// a reply that asks someone to forward it and a button to mark it forwarded.
// Returns the message ids, like sending to a channel.
export const sendForForwarding = async (
  post: Post,
  targetId: string,
  channelName: string,
  html: string,
  images: LoadedImage[]
): Promise<string> => {
  const chat = reviewTarget(await getSettings())
  if (!chat) throw new Error('No review topic is set up, so the message could not be given to anyone to forward')
  const ids = await sendToTelegramChannel(chat, html, images)
  const first = Number(ids.split(',')[0])
  await sendTelegramMessage(
    chat.chatId,
    chat.threadId,
    `📨 <b>Forward to ${esc(channelName)}</b> (${esc(post.title || 'Untitled')})\n` +
      `Forward the message${images.length > 1 ? 's' : ''} above to ${esc(channelName)} with "Hide sender name", then press the button.`,
    { buttons: [[{ text: '✅ Forwarded', callback_data: `fwd:${targetId}` }]], replyTo: first }
  )
  return ids
}
