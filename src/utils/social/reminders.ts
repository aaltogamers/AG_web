// Reminders of unapproved posts in the review topic, REMINDER_DAYS before their
// first message, mentioning who is responsible for the post and its image
import { listPostsToRemind, markReminded } from '../postStore'
import { formatTime, sendNotice } from './review'
import { escapeTelegramHtml as esc } from './telegram'
import { REMINDER_DAYS, type PostPerson } from './types'

const mention = (person: PostPerson) => `<a href="tg://user?id=${person.id}">${esc(person.name)}</a>`

const timeLeft = (iso: string) => {
  const hours = (new Date(iso).getTime() - Date.now()) / 3_600_000
  return hours < 36 ? `${Math.max(1, Math.round(hours))} h` : `${Math.round(hours / 24)} days`
}

export const sendReminders = async () => {
  for (const { post, firstSendAt } of await listPostsToRemind(REMINDER_DAYS)) {
    const needsImage = post.shouldHaveImage && !post.images.length
    const lines = [
      `⏰ <b>Not approved yet</b>, and the first message goes out ${formatTime(firstSendAt)} (in ${timeLeft(firstSendAt)}).`,
      ...(post.responsible ? [`${mention(post.responsible)}, please finish it and get it approved.`] : []),
      ...(needsImage
        ? [`🖼 It still needs an image${post.imageResponsible ? `, ${mention(post.imageResponsible)}` : ''}.`]
        : []),
    ]
    // Marked first, so that a failing message isn't sent again every minute
    await markReminded(post.id)
    await sendNotice(post, lines.join('\n'))
  }
}
