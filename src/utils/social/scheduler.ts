// Runs every 60 s (src/instrumentation.ts): due website changes, then due
// messages of approved posts (version == approved_version). Reports failures.
import moment from 'moment-timezone'
import { ensureMigrated } from '../db_pg'
import { EVENT_TIMEZONE } from '../eventUtils'
import {
  claimDueTargets,
  claimDueWebsiteChanges,
  claimMissedApprovals,
  deleteUnusedMedia,
  failMissedTargets,
  failStuckSending,
  finishDonePosts,
  finishTarget,
  finishWebsiteChange,
  getChannel,
  getInstagramTokenState,
  getPost,
  getSettings,
  getWebsiteChangeBase,
  markEventSaved,
  releaseTargetClaim,
  releaseWebsiteChangeClaim,
  saveInstagramTokenState,
  type DueTarget,
} from '../postStore'
import { sendToDiscordChannel } from './discord'
import { isInstagramConfigured, publishInstagramPost, refreshInstagramToken } from './instagram'
import { loadImage, publicImageUrl } from './media'
import { buildPreview } from './preview'
import { formatTime, sendNotice, sendReviewText } from './review'
import { sendToTelegramChannel, escapeTelegramHtml as esc } from './telegram'
import type { Post } from './types'
import { isConflict, runWebsiteChange } from './website'

const MAX_ATTEMPTS = 3

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

// Posts are claimed before they are loaded, and the parts of a post run one by
// one, so it may have been edited (taken off the schedule) since it was claimed.
// Only the approved version may run.
const isApproved = (post: Post | null): post is Post =>
  !!post && post.status === 'scheduled' && post.version === post.approvedVersion

const runWebsiteChanges = async () => {
  for (const { postId, attempts } of await claimDueWebsiteChanges()) {
    const post = await getPost(postId)
    if (!isApproved(post)) {
      await releaseWebsiteChangeClaim(postId)
      continue
    }
    const change = post.websiteChange
    if (!change) continue
    try {
      const { base, eventSaved } = await getWebsiteChangeBase(postId)
      const commitSha = await runWebsiteChange(post, change, base, eventSaved, (sha) =>
        markEventSaved(postId, sha)
      )
      await finishWebsiteChange(postId, { ok: true, commitSha })
      console.log(`[posts] website change of post #${postId} done`)
    } catch (err) {
      const error = errorText(err)
      console.error(`[posts] website change of post #${postId} failed:`, err)
      if (!isConflict(err) && attempts < MAX_ATTEMPTS) {
        await finishWebsiteChange(postId, { ok: false, error, retryInMinutes: 2 * attempts })
        continue
      }
      await finishWebsiteChange(postId, { ok: false, error })
      const held = post.targets.some((t) => t.status === 'pending')
      await sendNotice(
        post,
        `❗ <b>The website change failed</b>: ${esc(error)}\n` +
          (held
            ? 'The messages are held back until someone decides: 🔁 Retry runs the change again, ▶️ Send anyway sends the messages without it.'
            : '🔁 Retry runs the change again; ▶️ Send anyway skips it.'),
        { heldButtons: true }
      )
    }
  }
}

// The text each channel gets is rendered right before sending, from the approved version (isApproved)
const sendTarget = async (due: DueTarget, post: Post): Promise<{ externalMessageId: string; warning?: string }> => {
  const target = post.targets.find((t) => t.id === due.targetId)
  const channel = await getChannel(due.channelId)
  if (!target || !channel) throw new PermanentError('The channel no longer exists')
  if (!channel.enabled) {
    throw new PermanentError(`The channel was ${channel.deleted ? 'deleted' : 'disabled'} after the post was approved`)
  }
  const preview = await buildPreview({ ...post, targets: [target] })
  const rendered = preview.texts[0]
  const problems = rendered?.errors ?? ['Nothing to send']
  if (problems.length) throw new PermanentError(problems.join('; '))

  if (channel.platform === 'instagram') {
    const settings = await getSettings()
    const id = await publishInstagramPost(
      post.images.map((image) => publicImageUrl(image, settings.website.baseUrl)),
      rendered.text
    )
    return { externalMessageId: id }
  }
  const images = await Promise.all(post.images.map(loadImage))
  if (channel.platform === 'telegram') {
    const { chatId, threadId } = channel.config
    if (!chatId) throw new PermanentError('The channel has no chat id')
    return { externalMessageId: await sendToTelegramChannel({ chatId, threadId }, rendered.text, images) }
  }
  const { channelId, crosspost } = channel.config
  if (!channelId) throw new PermanentError('The channel has no Discord channel')
  const sent = await sendToDiscordChannel({ channelId, crosspost }, rendered.text, images)
  return { externalMessageId: sent.id, warning: sent.warning }
}

class PermanentError extends Error {}

const reportTargetFailure = async (post: Post, channelId: string, error: string) => {
  const channel = await getChannel(channelId)
  await sendNotice(post, `❗ <b>Sending to ${esc(channel?.name ?? 'a channel')} failed</b>: ${esc(error)}`)
}

const reportTargetProblem = async (post: Post, channelId: string, problem: string) => {
  const channel = await getChannel(channelId)
  await sendNotice(post, `⚠️ <b>${esc(channel?.name ?? 'A channel')}</b>: ${esc(problem)}`)
}

const sendDueTargets = async () => {
  for (const missed of await failMissedTargets()) {
    const post = await getPost(missed.postId)
    if (post) await reportTargetFailure(post, missed.channelId, 'Not sent: more than 30 minutes late (was the server down?)')
  }

  for (const due of await claimDueTargets()) {
    const post = await getPost(due.postId)
    if (!isApproved(post)) {
      await releaseTargetClaim(due.targetId)
      continue
    }
    try {
      const { externalMessageId, warning } = await sendTarget(due, post)
      await finishTarget(due.targetId, { ok: true, externalMessageId })
      console.log(`[posts] post #${post.id} sent to channel ${due.channelId}`)
      if (warning) await reportTargetProblem(post, due.channelId, warning)
    } catch (err) {
      const error = errorText(err)
      console.error(`[posts] sending post #${post.id} to channel ${due.channelId} failed:`, err)
      const noRetry = err instanceof PermanentError || (err as { noRetry?: boolean }).noRetry
      if (!noRetry && due.attempts < MAX_ATTEMPTS) {
        const retryAfter = (err as { retryAfter?: number }).retryAfter
        await finishTarget(due.targetId, {
          ok: false,
          error,
          retryInMinutes: Math.max(2 * due.attempts, Math.ceil((retryAfter ?? 0) / 60)),
        })
        continue
      }
      await finishTarget(due.targetId, { ok: false, error })
      await reportTargetFailure(post, due.channelId, `${error} (after ${due.attempts} attempt${due.attempts > 1 ? 's' : ''})`)
    }
  }
}

const reportInterrupted = async () => {
  const { targets, changes } = await failStuckSending()
  for (const t of targets) {
    const post = await getPost(t.postId)
    if (post) await reportTargetFailure(post, t.channelId, 'Interrupted while sending (e.g. a restart); check whether it went out')
  }
  for (const postId of changes) {
    const post = await getPost(postId)
    if (post) {
      await sendNotice(post, '❗ <b>The website change was interrupted</b> (e.g. a restart). Check the event, then retry or send anyway.', {
        heldButtons: true,
      })
    }
  }
}

const reportMissedApprovals = async () => {
  const settings = await getSettings()
  for (const postId of await claimMissedApprovals(settings.website.leadMinutes)) {
    const post = await getPost(postId)
    if (post) {
      await sendNotice(post, '⏰ <b>Not approved in time</b>, so nothing was sent. Choose new times on the website and approve again.')
    }
  }
}

// Instagram tokens last 60 days. Renewed about weekly; reported when renewing fails
// and less than 10 days are left.
const checkInstagramToken = async () => {
  if (!isInstagramConfigured()) return
  const state = await getInstagramTokenState()
  const daysSince = (iso?: string) => (iso ? (Date.now() - new Date(iso).getTime()) / 86_400_000 : Infinity)
  if (daysSince(state.refreshedAt) < 7) return
  try {
    const expiresAt = await refreshInstagramToken()
    console.log(`[posts] Instagram token renewed, valid until ${expiresAt}`)
  } catch (err) {
    const error = errorText(err)
    await saveInstagramTokenState({ lastError: error })
    const daysLeft = state.expiresAt ? -daysSince(state.expiresAt) : null
    if (daysLeft === null || daysLeft < 10) {
      await sendReviewText(
        `❗ <b>Instagram token</b>: ${esc(error)}. ${
          daysLeft === null
            ? 'Its expiry date is not known.'
            : daysLeft <= 0
              ? 'It has expired, so Instagram posts fail until a new token is set (INSTAGRAM_ACCESS_TOKEN).'
              : `It expires ${formatTime(state.expiresAt ?? null)}.`
        }`
      )
    }
  }
}

let lastDailyRun: string | null = null

const runDaily = async () => {
  const now = moment().tz(EVENT_TIMEZONE)
  const today = now.format('YYYY-MM-DD')
  if (now.hour() < 4 || lastDailyRun === today) return
  lastDailyRun = today
  await checkInstagramToken().catch((err) => console.error('[posts] Instagram token check failed:', err))
  await deleteUnusedMedia().catch((err) => console.error('[posts] cleaning up images failed:', err))
}

let running = false

export const runSchedulerTick = async () => {
  if (running || !process.env.DATABASE_URL) return
  running = true
  try {
    await ensureMigrated()
    await reportInterrupted()
    await runWebsiteChanges()
    await sendDueTargets()
    await finishDonePosts()
    await reportMissedApprovals()
    await runDaily()
  } catch (err) {
    console.error('[posts] scheduler tick failed:', err)
  } finally {
    running = false
  }
}
