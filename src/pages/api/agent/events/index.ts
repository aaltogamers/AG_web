import { AgentError, agentHandler, getBody } from '../../../../utils/agentApi'
import { describeEvent, eventUrl, parseEventInput } from '../../../../utils/agentEvents'
import {
  eventFromFile,
  getFreeSlug,
  listEventFiles,
  saveEventFile,
} from '../../../../utils/eventFiles'
import { eventMoment } from '../../../../utils/eventUtils'

export default agentHandler({
  // Events in the repo. `?scope=upcoming` (default) has events that haven't ended
  // or have no time yet, `past` those that have, `all` both.
  GET: async (req) => {
    const scope = req.query.scope || 'upcoming'
    if (scope !== 'upcoming' && scope !== 'past' && scope !== 'all') {
      throw new AgentError(400, 'scope must be upcoming, past or all')
    }
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
  },

  POST: async (req) => {
    const input = getBody(req)
    if (!input.name) throw new AgentError(400, 'name is required')
    if (!input.description) throw new AgentError(400, 'description is required')
    const { data, body } = parseEventInput(input, new Set())
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
      note: `Created. It appears on ${eventUrl(slug)} after the site has been rebuilt, in about 5 minutes. Sign-up forms can be created right away.`,
    }
  },
})
