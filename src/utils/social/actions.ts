// Post status changes: the database change (postStore.ts) and the review topic
// messages. Only the admin API and the webhook (humans) can approve.
import { AgentError } from '../agentApi'
import { getEventFile } from '../eventFiles'
import {
  type Actor,
  createPost,
  describeActor,
  getPostOrThrow,
  getSettings,
  markApproved,
  markCancelled,
  markRejected,
  releaseHeld,
  setAwaitingApproval,
  setWebsiteChangeSlug,
  updatePost,
  websiteRunAt,
  withdrawApprovalRequest,
} from '../postStore'
import { buildPreview, previewErrors } from './preview'
import { escapeTelegramHtml as esc } from './telegram'
import { announceDecision, approvalNote, closeOpenMessages, sendReview } from './review'
import type { Post, PostInput } from './types'
import { chooseNewEventSlug, committedByPost, snapshotBase } from './website'

// Times up to this much in the past still count as "now" when approving
const GRACE_MS = 2 * 60_000

const ensureValid = async (post: Post) => {
  const errors = previewErrors(await buildPreview(post))
  if (errors.length) throw new AgentError(400, `Fix these first: ${errors.join('; ')}`)
}

export const createPostAction = (input: PostInput, actor: Actor) => createPost(input, actor)

// Sends the review and says where it went, for the agent and the website
const sendReviewWithNote = async (post: Post, options: Parameters<typeof sendReview>[1]) => {
  try {
    if (await sendReview(post, options)) return 'A review was sent to the review topic in Telegram.'
  } catch (err) {
    console.error('[posts] sending the review failed:', err)
    const error = err instanceof Error ? err.message : String(err)
    return `Sending the review to Telegram failed (${error}). It can be approved on the website.`
  }
  const settings = await getSettings()
  return settings.telegram.reviewChatId
    ? 'The review could not be sent to Telegram (TELEGRAM_POSTS_BOT_TOKEN is not set). It can be approved on the website.'
    : 'No review topic is set up in Telegram, so it can only be approved on the website.'
}

export const requestApproval = async (id: string, actor: Actor) => {
  const post = await getPostOrThrow(id)
  if (post.status !== 'draft' && post.status !== 'awaiting_approval') {
    throw new AgentError(409, `The post is ${post.status.replace('_', ' ')}; only drafts can be sent for approval`)
  }
  await ensureValid(post)
  await setAwaitingApproval(post, actor)
  const updated = await getPostOrThrow(id)
  return { post: updated, note: await sendReviewWithNote(updated, { requestedBy: actor }) }
}

export const withdrawApproval = async (id: string, actor: Actor) => {
  const post = await getPostOrThrow(id)
  await withdrawApprovalRequest(post, actor)
  await closeOpenMessages(post.id, `<i>Withdrawn by ${esc(describeActor(actor))}</i>`).catch(() => undefined)
  return getPostOrThrow(id)
}

// Edits a post. The agent's edits of a post awaiting approval or approved send a
// new review; the admin's edits take it back to draft. `version` is the version the edit was made on.
export const editPost = async (
  id: string,
  input: PostInput,
  actor: Actor,
  version?: number
) => {
  const { post, previousStatus } = await updatePost(id, input, actor, version)
  const wasInReview = previousStatus === 'awaiting_approval' || previousStatus === 'scheduled'
  let note: string | undefined
  if (actor === 'agent' && wasInReview) {
    const reviewNote = await sendReviewWithNote(post, {
      requestedBy: actor,
      editedAfterApproval: previousStatus === 'scheduled',
    })
    note = `${previousStatus === 'scheduled' ? 'The post was approved, so the edit took it off the schedule until it is approved again. ' : ''}${reviewNote}`
  } else if (wasInReview) {
    await closeOpenMessages(post.id, `<i>✏️ Edited on the website (v${post.version})</i>`).catch(() => undefined)
  }
  return { post, note }
}

export const approvePost = async (id: string, version: number, actor: Actor) => {
  if (actor === 'agent') throw new AgentError(403, 'Only a human can approve posts')
  const post = await getPostOrThrow(id)
  if (post.version !== version) throw new AgentError(409, 'The post has been edited since, this is out of date')
  if (post.status !== 'awaiting_approval' && !(post.status === 'draft' && actor === 'admin')) {
    throw new AgentError(409, `The post is ${post.status.replace('_', ' ')}, it can't be approved`)
  }
  await ensureValid(post)
  const settings = await getSettings()

  const now = Date.now() - GRACE_MS
  const late = post.targets
    .filter((t) => t.status === 'pending' || t.status === 'held' || t.status === 'failed')
    .filter((t) => new Date(t.sendAt ?? post.sendAt ?? 0).getTime() < now)
  if (late.length) {
    throw new AgentError(400, 'Some send times have passed. Choose new times on the website and approve there.')
  }

  // A new event's address is chosen now, so the links in the messages are known
  const change = post.websiteChange
  let eventSlug: string | null = null
  let base: Record<string, unknown> | null = null
  let scheduledRunAt: string | null = null
  if (change && (change.status === 'pending' || change.status === 'failed' || change.status === 'cancelled')) {
    if (change.kind === 'create_event') {
      eventSlug = await chooseNewEventSlug(post, change)
    } else {
      base = snapshotBase(change, change.eventSlug ? await getEventFile(change.eventSlug) : null)
    }
    scheduledRunAt = websiteRunAt(post, settings.website.leadMinutes)
    if (scheduledRunAt && new Date(scheduledRunAt).getTime() < now) {
      // A lead time that has already passed runs the change right away
      scheduledRunAt = new Date().toISOString()
    }
  }
  await markApproved(post, version, actor, { eventSlug, base, scheduledRunAt })
  const approved = await getPostOrThrow(id)
  await announceDecision(approved, version, approvalNote(approved, actor, settings))
  return approved
}

export const rejectPost = async (id: string, version: number, actor: Actor, comment?: string) => {
  if (actor === 'agent') throw new AgentError(403, 'Only a human can reject posts')
  const post = await getPostOrThrow(id)
  await markRejected(post, version, actor, comment)
  const settings = await getSettings()
  await announceDecision(post, version, `❌ <b>Rejected by ${esc(describeActor(actor, settings))}</b>${comment ? `: ${esc(comment)}` : ''}`)
  return getPostOrThrow(id)
}

export const cancelPost = async (id: string, actor: Actor) => {
  if (actor === 'agent') throw new AgentError(403, 'Only a human can cancel posts')
  const post = await getPostOrThrow(id)
  if (post.status === 'done' || post.status === 'cancelled') {
    throw new AgentError(409, `The post is already ${post.status}`)
  }
  await markCancelled(post, actor)
  await closeOpenMessages(post.id, `🚫 <b>Cancelled by ${esc(describeActor(actor, await getSettings()))}</b>`).catch(() => undefined)
  return getPostOrThrow(id)
}

// After a failed website change: run it again (overwriting conflicting edits,
// or with a new address if the old one was taken), or send the messages without it
export const releaseHeldPost = async (
  id: string,
  version: number,
  actor: Actor,
  mode: 'retry' | 'send_anyway',
  newTime: string | null = null
) => {
  if (actor === 'agent') throw new AgentError(403, 'Only a human can do this')
  const post = await getPostOrThrow(id)
  const change = post.websiteChange
  if (!change || change.status !== 'failed') throw new AgentError(409, 'The website change has not failed')
  let base: Record<string, unknown> | null = null
  if (mode === 'retry') {
    // A new address only if someone else took it; not if an interrupted run of this post created the event
    if (
      change.kind === 'create_event' &&
      change.eventSlug &&
      (await getEventFile(change.eventSlug)) &&
      !(await committedByPost(post, change.eventSlug))
    ) {
      const slug = await chooseNewEventSlug(post, change)
      await setWebsiteChangeSlug(post.id, slug)
    }
    if (change.kind === 'update_event' && change.eventSlug) {
      base = snapshotBase(change, await getEventFile(change.eventSlug))
    }
  }
  await releaseHeld(post, version, actor, mode, newTime, base)
  const settings = await getSettings()
  await closeOpenMessages(
    post.id,
    mode === 'retry'
      ? `🔁 <b>Retried by ${esc(describeActor(actor, settings))}</b>`
      : `▶️ <b>Sent without the website change by ${esc(describeActor(actor, settings))}</b>`
  ).catch(() => undefined)
  return getPostOrThrow(id)
}
