// Reminders of unapproved posts in the review topic before their first message:
// that it is a draft (REMINDER_DAYS), approval requests (APPROVAL_REQUEST_DAYS)
// and missing images (IMAGE_REMINDER_DAYS). Ones due at once are sent as one message.
// A post with canMakeFrom has none of these before it; it is nudged to be made at it
// and then daily. Edits from the first approval request time on (canMakeFrom, or
// creation for the agent's posts sent on approval) are sent for approval a minute later.
import {
  listEditedPostsToRequest,
  listPostsToNudgeCanMake,
  listPostsToRemind,
  markReminded,
  type ReminderKind,
} from '../postStore'
import { requestApproval } from './actions'
import { formatTime, sendNotice } from './review'
import { escapeTelegramHtml as esc } from './telegram'
import { APPROVAL_REQUEST_DAYS, IMAGE_REMINDER_DAYS, REMINDER_DAYS, type Post, type PostPerson } from './types'

const mention = (person: PostPerson) => `<a href="tg://user?id=${person.id}">${esc(person.name)}</a>`

const timeLeft = (iso: string) => {
  const hours = (new Date(iso).getTime() - Date.now()) / 3_600_000
  return hours < 36 ? `${Math.max(1, Math.round(hours))} h` : `${Math.round(hours / 24)} days`
}

const needsImage = (post: Post) => post.shouldHaveImage && !post.images.length

const DAYS: Record<Exclude<ReminderKind, 'canMake'>, readonly number[]> = {
  draft: REMINDER_DAYS,
  approval: APPROVAL_REQUEST_DAYS,
  image: IMAGE_REMINDER_DAYS,
}

const remind = async (post: Post, firstSendAt: string | null, kinds: Set<ReminderKind>) => {
  // Marked first, so that a failing message isn't sent again every minute
  await markReminded(post.id, [...kinds])
  const askImage = needsImage(post) && (kinds.has('image') || kinds.has('approval') || kinds.has('canMake'))
  if (!kinds.has('approval') && !kinds.has('draft') && !kinds.has('canMake') && !askImage) return

  const when = firstSendAt
    ? `the first message goes out ${formatTime(firstSendAt)} (in ${timeLeft(firstSendAt)})`
    : 'it is sent when approved'
  const lines: string[] = []
  if (kinds.has('approval')) {
    await requestApproval(post)
    lines.push(`⏳ <b>Sent for approval</b>; ${when}.`)
    if (post.responsible) lines.push(`${mention(post.responsible)}, please check it and get it approved.`)
  } else if (kinds.has('canMake')) {
    lines.push(`🛠 <b>It can be made now</b>, and ${when}.`)
    lines.push(
      `${post.responsible ? `${mention(post.responsible)}, please make it` : 'Please make it'}; it is sent for approval a minute after it is edited.`
    )
  } else if (kinds.has('draft')) {
    lines.push(`⏰ <b>Not approved yet</b>, and ${when}.`)
    if (post.responsible) lines.push(`${mention(post.responsible)}, please finish it and get it approved.`)
  } else {
    lines.push(`🖼 <b>No image yet</b>, and ${when}.`)
  }
  if (askImage) {
    const person = post.imageResponsible ?? post.responsible
    lines.push(`🖼 It still needs an image${person ? `, ${mention(person)}` : ''}.`)
  }
  await sendNotice(post, lines.join('\n'))
}

export const sendReminders = async () => {
  const due = new Map<string, { post: Post; firstSendAt: string | null; kinds: Set<ReminderKind> }>()
  const add = (kind: ReminderKind, { post, firstSendAt }: { post: Post; firstSendAt: string | null }) => {
    const entry = due.get(post.id) ?? { post, firstSendAt, kinds: new Set() }
    entry.kinds.add(kind)
    due.set(post.id, entry)
  }
  for (const item of await listPostsToNudgeCanMake()) add('canMake', item)
  for (const item of await listEditedPostsToRequest(Math.max(...APPROVAL_REQUEST_DAYS))) add('approval', item)
  for (const kind of Object.keys(DAYS) as (keyof typeof DAYS)[]) {
    for (const item of await listPostsToRemind(kind, DAYS[kind])) add(kind, item)
  }
  for (const { post, firstSendAt, kinds } of due.values()) {
    await remind(post, firstSendAt, kinds).catch((err) =>
      console.error(`[posts] reminding about post #${post.id} failed:`, err)
    )
  }
}
