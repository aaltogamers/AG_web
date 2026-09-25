import type { NextApiRequest } from 'next'
import { AgentError, agentHandler, getBody, parseAgentTime } from '../../../utils/agentApi'
import {
  describeForm,
  parseFields,
  parsePools,
  participantsError,
} from '../../../utils/agentEvents'
import { eventFromFile, getEventFile } from '../../../utils/eventFiles'
import { getSignupTargets } from '../../../utils/eventUtils'
import {
  deleteSignupForms,
  getSignupFormKeysOfEvent,
  getSignupSummaries,
  saveSignupForm,
  totalSignups,
} from '../../../utils/signupForms'
import type { SignUpData } from '../../../types/types'

const getEventOrThrow = async (slug: unknown) => {
  if (typeof slug !== 'string' || !slug) throw new AgentError(400, 'eventSlug is required')
  const file = await getEventFile(slug)
  if (!file) throw new AgentError(404, `No event with slug "${slug}"`)
  return eventFromFile(file)
}

const getFormOrThrow = async (req: NextApiRequest) => {
  const key = typeof req.query.key === 'string' ? req.query.key : ''
  if (!key) throw new AgentError(400, 'key is required')
  const [form] = await getSignupSummaries([key])
  if (!form) throw new AgentError(404, `No sign-up form with key "${key}"`)
  return form
}

const parseOpenTimes = (openFrom: unknown, openUntil: unknown) => {
  const from = parseAgentTime(openFrom, 'openFrom')
  const until = parseAgentTime(openUntil, 'openUntil')
  if (!until.isAfter(from)) throw new AgentError(400, 'openUntil must be after openFrom')
  return { openfrom: from.toISOString(), openuntil: until.toISOString() }
}

const save = async (data: SignUpData) => {
  const result = await saveSignupForm(data)
  if ('error' in result) throw new AgentError(400, result.error)
  const [form] = await getSignupSummaries([data.key])
  return form
}

export default agentHandler({
  // `?eventSlug=` - the event's sign-up forms with sign-up counts per pool
  GET: async (req) => {
    const event = await getEventOrThrow(req.query.eventSlug)
    const targets = getSignupTargets(event)
    const keys = await getSignupFormKeysOfEvent(event.slug)
    const forms = await getSignupSummaries(keys)
    return {
      eventSlug: event.slug,
      eventName: event.name,
      signupMode: event.signupMode,
      forms: targets.map((target) => {
        const form = forms.find((f) => f.key === target.key)
        return form
          ? { exists: true, ...describeForm(form, target) }
          : { exists: false, key: target.key, sessionId: target.session?.id }
      }),
      // Left over from sessions that no longer exist, only visible in the admin panel
      formsOfRemovedSessions: forms
        .filter((f) => !targets.some((t) => t.key === f.key))
        .map((f) => describeForm(f)),
    }
  },

  POST: async (req) => {
    const body = getBody(req)
    const event = await getEventOrThrow(body.eventSlug)
    if (event.signupMode === 'none') {
      throw new AgentError(
        409,
        `Sign-up is not enabled for "${event.slug}". Set its signupMode to "event" or "session" first.`
      )
    }
    const targets = getSignupTargets(event)
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    const target =
      event.signupMode === 'event' ? targets[0] : targets.find((t) => t.session?.id === sessionId)
    if (!target) {
      throw new AgentError(
        400,
        `This event has a separate sign-up per session, so sessionId must be one of: ${targets
          .map((t) => `${t.session?.id} (${t.session?.name ?? t.session?.start})`)
          .join(', ')}`
      )
    }
    if ((await getSignupSummaries([target.key])).length) {
      throw new AgentError(409, `Sign-up form "${target.key}" already exists, update it instead`)
    }

    const form = await save({
      key: target.key,
      ...parseOpenTimes(body.openFrom, body.openUntil),
      pools: parsePools(body.pools),
      inputs: parseFields(body.fields),
    })
    return { form: describeForm(form, target) }
  },

  // `?key=` - changes only the given fields
  PATCH: async (req) => {
    const form = await getFormOrThrow(req)
    const body = getBody(req)

    const pools = body.pools === undefined ? form.pools : parsePools(body.pools, form.pools)
    const removedWithSignups = form.pools.filter(
      (p) => (form.counts[p.id] ?? 0) > 0 && !pools.some((newPool) => newPool.id === p.id)
    )
    if (removedWithSignups.length) {
      throw new AgentError(
        409,
        `Can't remove pools that have sign-ups: ${removedWithSignups.map((p) => `${p.name} (id ${p.id})`).join(', ')}`
      )
    }

    const updated = await save({
      key: form.key,
      ...parseOpenTimes(body.openFrom ?? form.openfrom, body.openUntil ?? form.openuntil),
      pools,
      inputs: body.fields === undefined ? form.inputs : parseFields(body.fields),
    })
    return { form: describeForm(updated) }
  },

  // `?key=` - only forms without sign-ups can be deleted
  DELETE: async (req) => {
    const form = await getFormOrThrow(req)
    if (totalSignups(form) > 0) throw participantsError([form], 'delete the sign-up form')
    await deleteSignupForms([form.key])
    return { deleted: form.key }
  },
})
