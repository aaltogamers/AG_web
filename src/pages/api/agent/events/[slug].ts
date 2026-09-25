import type { NextApiRequest } from 'next'
import { AgentError, agentHandler, getBody } from '../../../../utils/agentApi'
import {
  describeEvent,
  formsWithParticipants,
  parseEventInput,
  participantsError,
} from '../../../../utils/agentEvents'
import {
  deleteEventFile,
  eventFromFile,
  getEventFile,
  saveEventFile,
} from '../../../../utils/eventFiles'
import { getSignupTargets } from '../../../../utils/eventUtils'
import { deleteSignupForms, getSignupFormKeysOfEvent } from '../../../../utils/signupForms'

const getFileOrThrow = async (req: NextApiRequest) => {
  const slug = String(req.query.slug)
  const file = await getEventFile(slug)
  if (!file) throw new AgentError(404, `No event with slug "${slug}"`)
  return file
}

export default agentHandler({
  GET: async (req) => ({ event: describeEvent(eventFromFile(await getFileOrThrow(req)), true) }),

  // Changes only the given fields
  PATCH: async (req) => {
    const file = await getFileOrThrow(req)
    const oldEvent = eventFromFile(file)
    const sessionIds = new Set(oldEvent.sessions.flatMap((s) => s.id ?? []))
    const { data, body } = parseEventInput(getBody(req), sessionIds)
    if (!Object.keys(data).length && body === undefined) {
      throw new AgentError(400, 'Nothing to update')
    }

    const updated = { ...file, data: { ...file.data, ...data }, body: body ?? file.body }
    const newEvent = eventFromFile(updated)

    // Sign-up forms of sessions that are removed, or of a sign-up mode that is
    // changed, would be left without an event
    const newKeys = new Set(getSignupTargets(newEvent).map((t) => t.key))
    const existingKeys = new Set(await getSignupFormKeysOfEvent(file.slug))
    const orphaned = getSignupTargets(oldEvent)
      .map((t) => t.key)
      .filter((key) => existingKeys.has(key) && !newKeys.has(key))
    const blocking = await formsWithParticipants(orphaned)
    if (blocking.length) {
      throw participantsError(
        blocking,
        'remove these sessions or change the sign-up mode (keep session ids to keep their forms)'
      )
    }

    await saveEventFile(
      file.slug,
      updated.data,
      updated.body,
      `Update Event “${file.slug}” (AI agent)`,
      file.sha
    )
    await deleteSignupForms(orphaned)
    return {
      event: describeEvent(newEvent, true),
      deletedEmptySignupForms: orphaned,
      note: 'Saved. The change is visible on the site after it has been rebuilt, in about 5 minutes.',
    }
  },

  // Also deletes the event's sign-up forms, which is refused if any has sign-ups
  DELETE: async (req) => {
    const file = await getFileOrThrow(req)
    const keys = await getSignupFormKeysOfEvent(file.slug)
    const blocking = await formsWithParticipants(keys)
    if (blocking.length) throw participantsError(blocking, 'delete the event')

    await deleteEventFile(file, `Delete Event “${file.slug}” (AI agent)`)
    await deleteSignupForms(keys)
    return { deleted: file.slug, deletedEmptySignupForms: keys }
  },
})
