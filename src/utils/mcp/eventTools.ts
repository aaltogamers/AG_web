import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { AgentError } from '../agentApi'
import {
  describeEvent,
  eventUrl,
  formsWithParticipants,
  parseEventInput,
  participantsError,
} from '../agentEvents'
import {
  deleteEventFile,
  eventFromFile,
  getEventFile,
  getFreeSlug,
  listEventFiles,
  saveEventFile,
} from '../eventFiles'
import { eventMoment, getSignupTargets } from '../eventUtils'
import { deleteSignupForms, getSignupFormKeysOfEvent } from '../signupForms'
import { givenArgs, runTool } from './server'

const TIME_HINT = 'Helsinki time, e.g. 2026-10-24T18:00'

export const sessionSchema = z.object({
  id: z
    .string()
    .optional()
    .describe(
      'Id of an existing session. Keep it to keep the session and its sign-up form, leave it out for new sessions.'
    ),
  name: z.string().optional().describe('Optional, e.g. "Qualifiers" or "Finals"'),
  start: z.string().describe(TIME_HINT),
  end: z.string().optional().describe(`${TIME_HINT}. Defaults to 2 hours after start.`),
  location: z.string(),
})

// Fields of create_event and update_event, in the order of the CMS
const eventFields = {
  name: z.string(),
  sessions: z
    .array(sessionSchema)
    .describe(
      'Times and places, one per day or part of the event. Empty if the time is not known yet. Replaces all sessions.'
    ),
  signupMode: z
    .enum(['none', 'event', 'session'])
    .describe(
      'none (default): no sign-up, event: one sign-up for the whole event, session: a separate sign-up for each session'
    ),
  image: z
    .string()
    .nullable()
    .describe('Image path like /images/foo.png. If empty, the AG logo is shown.'),
  visibleOnCalendar: z.boolean().describe('Defaults to true'),
  visibleOnEventsPage: z.boolean().describe('Defaults to true'),
  description: z.string().describe('Short description in markdown, shown in the event list'),
  body: z
    .string()
    .nullable()
    .describe(
      'Long description in markdown, shown on the event page. If empty, the short description is shown there instead.'
    ),
  recordings: z
    .array(z.object({ name: z.string().optional(), url: z.string() }))
    .describe('Recordings, e.g. YouTube links. Replaces all recordings.'),
}
const optionalEventFields = z.object(eventFields).partial().shape

const getFileOrThrow = async (slug: string) => {
  const file = await getEventFile(slug)
  if (!file) throw new AgentError(404, `No event with slug "${slug}"`)
  return file
}

export const registerEventTools = (server: McpServer) => {
  server.registerTool(
    'list_events',
    {
      title: 'List events',
      description:
        'Lists events without their long description. upcoming (default) has events that have not ended or have no time yet, sorted by start; past has ended events, newest first; all has both.',
      inputSchema: { scope: z.enum(['upcoming', 'past', 'all']).optional() },
      annotations: { readOnlyHint: true },
    },
    runTool('list_events', async ({ scope = 'upcoming' }) => {
      const now = Date.now()
      const lastEnd = (sessions: { end: string }[]) =>
        Math.max(...sessions.map((s) => eventMoment(s.end).valueOf()))
      const firstStart = (sessions: { start: string }[]) =>
        sessions.length ? eventMoment(sessions[0].start).valueOf() : Infinity

      const events = (await listEventFiles())
        .map(eventFromFile)
        .filter((event) => {
          if (scope === 'all') return true
          const hasEnded = event.sessions.length > 0 && lastEnd(event.sessions) < now
          return scope === 'past' ? hasEnded : !hasEnded
        })
        .sort((a, b) =>
          scope === 'past'
            ? firstStart(b.sessions) - firstStart(a.sessions)
            : firstStart(a.sessions) - firstStart(b.sessions)
        )
      return { events: events.map((event) => describeEvent(event)) }
    })
  )

  server.registerTool(
    'get_event',
    {
      title: 'Get event',
      description: 'Gets an event with its long description and recordings.',
      inputSchema: { slug: z.string() },
      annotations: { readOnlyHint: true },
    },
    runTool('get_event', async ({ slug }) => ({
      event: describeEvent(eventFromFile(await getFileOrThrow(slug)), true),
    }))
  )

  server.registerTool(
    'create_event',
    {
      title: 'Create event',
      description:
        'Creates an event. Its slug is made from the name. Sign-up forms can be created for it right away.',
      inputSchema: {
        ...optionalEventFields,
        name: eventFields.name,
        description: eventFields.description,
      },
    },
    runTool('create_event', async (args) => {
      const { data, body } = parseEventInput(givenArgs(args), new Set())
      const slug = await getFreeSlug(data.name as string)
      const fullData = {
        sessions: [],
        signupMode: 'none',
        visibleOnCalendar: true,
        visibleOnEventsPage: true,
        recordings: [],
        ...data,
      }
      await saveEventFile(slug, fullData, body ?? '', `Create Event “${slug}” (AI agent)`)
      return {
        event: describeEvent(
          eventFromFile({ slug, data: fullData, body: body ?? '', sha: '' }),
          true
        ),
        note: `Created. It appears on ${eventUrl(slug)} after the site has been rebuilt, in 2-3 minutes. Sign-up forms can be created right away. Link the event to the user.`,
      }
    })
  )

  server.registerTool(
    'update_event',
    {
      title: 'Update event',
      description:
        'Changes only the given fields of an event; null clears image or body. Removing sessions or changing signupMode deletes the sign-up forms that no longer belong to the event, which is refused if they have sign-ups.',
      inputSchema: { slug: z.string(), ...optionalEventFields },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    runTool('update_event', async ({ slug, ...fields }) => {
      const file = await getFileOrThrow(slug)
      const oldEvent = eventFromFile(file)
      const sessionIds = new Set(oldEvent.sessions.flatMap((s) => s.id ?? []))
      const { data, body } = parseEventInput(givenArgs(fields), sessionIds)
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
        note: `Saved. The change is visible on ${eventUrl(file.slug)} after the site has been rebuilt, in 2-3 minutes. Link the event to the user.`,
      }
    })
  )

  server.registerTool(
    'delete_event',
    {
      title: 'Delete event',
      description:
        'Deletes an event and its sign-up forms. Refused if any of its sign-up forms has sign-ups.',
      inputSchema: { slug: z.string() },
      annotations: { destructiveHint: true },
    },
    runTool('delete_event', async ({ slug }) => {
      const file = await getFileOrThrow(slug)
      const keys = await getSignupFormKeysOfEvent(file.slug)
      const blocking = await formsWithParticipants(keys)
      if (blocking.length) throw participantsError(blocking, 'delete the event')

      await deleteEventFile(file, `Delete Event “${file.slug}” (AI agent)`)
      await deleteSignupForms(keys)
      return { deleted: file.slug, deletedEmptySignupForms: keys }
    })
  )
}
