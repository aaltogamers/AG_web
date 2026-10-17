// Saving and deleting events in the admin event editor (/admin/events), with the
// sign-up forms that a change leaves without a session or sign-up mode
import { AgentError } from './agentApi'
import { withTransaction } from './db_pg'
import {
  deleteEvent,
  eventFromStored,
  eventsChanged,
  getFreeSlug,
  saveEvent,
  validateEvent,
} from './eventStore'
import { deleteSignupForms, getSignupFormKeysOfEvent, getSignupSummaries, signupFormsLeftOver, totalSignups } from './signupForms'
import type { SignupSummary } from './signupApi'

const AUTHOR = 'admin'

const formsList = (forms: SignupSummary[]) =>
  forms.map((f) => `"${f.key}" (${totalSignups(f)} sign-ups)`).join(', ')

export const createEventAsAdmin = async (data: Record<string, unknown>, body: string) => {
  const valid = validateEvent(data)
  const slug = await getFreeSlug(String(valid.name))
  return saveEvent({ slug, data: valid, body, version: null, author: AUTHOR })
}

// Empty forms left over are deleted; forms with sign-ups must be kept
export const updateEventAsAdmin = async (
  slug: string,
  data: Record<string, unknown>,
  body: string,
  version: number
) => {
  const valid = validateEvent(data)
  const leftOver = await signupFormsLeftOver(eventFromStored({ slug, data: valid, body }))
  const withSignups = leftOver.filter((f) => totalSignups(f) > 0)
  if (withSignups.length) {
    throw new AgentError(
      409,
      `These sign-up forms would be left without a session or sign-up mode: ${formsList(withSignups)}. Keep their sessions, or delete the forms in the event editor first.`
    )
  }
  const deletedSignupForms = leftOver.map((f) => f.key)
  const event = await withTransaction(async (client) => {
    const saved = await saveEvent({ slug, data: valid, body, version, author: AUTHOR }, client)
    await deleteSignupForms(deletedSignupForms, client)
    return saved
  })
  eventsChanged()
  return { event, deletedSignupForms }
}

// With its sign-up forms, if none of them has sign-ups
export const deleteEventAsAdmin = async (slug: string, version: number) => {
  const forms = await getSignupSummaries(await getSignupFormKeysOfEvent(slug))
  const withSignups = forms.filter((f) => totalSignups(f) > 0)
  if (withSignups.length) {
    throw new AgentError(
      409,
      `The event has sign-ups: ${formsList(withSignups)}. Delete the sign-up forms in the event editor first.`
    )
  }
  await withTransaction(async (client) => {
    await deleteEvent(slug, version, AUTHOR, client)
    await deleteSignupForms(
      forms.map((f) => f.key),
      client
    )
  })
  eventsChanged()
}
