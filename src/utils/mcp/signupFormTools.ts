import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { SignUpData } from '../../types/types'
import { AgentError, optionalString, parseAgentTime } from '../agentApi'
import { describeForm, parseFields, parsePools, participantsError } from '../agentEvents'
import { eventFromFile, getEventFile } from '../eventFiles'
import { getSignupTargets } from '../eventUtils'
import {
  deleteSignupForms,
  getSignupFormKeysOfEvent,
  getSignupSummaries,
  saveSignupForm,
  totalSignups,
} from '../signupForms'
import { runTool } from './server'

const TIME_HINT = 'Helsinki time, e.g. 2026-10-24T18:00'

const poolSchema = z.object({
  id: z
    .number()
    .int()
    .optional()
    .describe('Id of an existing pool. Keep it to keep its sign-ups, leave it out for new pools.'),
  name: z.string(),
  size: z
    .number()
    .int()
    .min(0)
    .describe('Places in the pool. Sign-ups beyond it go to the reserve list.'),
  private: z.boolean().optional().describe('Private pools need a password to sign up to'),
  password: z
    .string()
    .optional()
    .describe('Password of a private pool. Leave it out to keep the current one.'),
})

const fieldSchema = z.object({
  id: z
    .number()
    .int()
    .optional()
    .describe('Id of an existing field. Keep it to keep its answers, leave it out for new fields.'),
  type: z.enum(['text', 'select', 'info']).describe('info only shows its title and description'),
  title: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  public: z.boolean().optional().describe("Whether answers are shown on the event's sign-up list"),
  options: z.array(z.string()).optional().describe('Options of a select field'),
  multi: z.boolean().optional().describe('Whether several options of a select field can be chosen'),
})

const formFields = {
  openFrom: z.string().describe(`When sign-up opens. ${TIME_HINT}`),
  openUntil: z.string().describe(`When sign-up closes. ${TIME_HINT}`),
  pools: z
    .array(poolSchema)
    .min(1)
    .describe(
      'Groups of places, e.g. one "Participants" pool. Replaces all pools; pools with sign-ups cannot be removed.'
    ),
  fields: z
    .array(fieldSchema)
    .describe('Questions asked in addition to the name, in order. Replaces all fields.'),
  confirmedMessage: z
    .string()
    .nullable()
    .describe('Shown only to participants who got a place. null removes it.'),
  confirmedLink: z
    .string()
    .nullable()
    .describe(
      'Link shown only to participants who got a place, e.g. a Telegram group. null removes it.'
    ),
}

const getEventOrThrow = async (slug: string) => {
  const file = await getEventFile(slug)
  if (!file) throw new AgentError(404, `No event with slug "${slug}"`)
  return eventFromFile(file)
}

const getFormOrThrow = async (key: string) => {
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

export const registerSignupFormTools = (server: McpServer) => {
  server.registerTool(
    'get_signup_forms',
    {
      title: 'Get sign-up forms',
      description:
        "Gets an event's sign-up forms with sign-up counts per pool, and the forms it can still have. Participants' answers are never shown.",
      inputSchema: { eventSlug: z.string() },
      annotations: { readOnlyHint: true },
    },
    runTool('get_signup_forms', async ({ eventSlug }) => {
      const event = await getEventOrThrow(eventSlug)
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
    })
  )

  server.registerTool(
    'create_signup_form',
    {
      title: 'Create sign-up form',
      description:
        'Creates the sign-up form of an event whose signupMode is event, or of one session of an event whose signupMode is session.',
      inputSchema: {
        eventSlug: z.string(),
        sessionId: z
          .string()
          .optional()
          .describe('Required when the event has a separate sign-up per session'),
        ...formFields,
        fields: formFields.fields.optional(),
        confirmedMessage: formFields.confirmedMessage.optional(),
        confirmedLink: formFields.confirmedLink.optional(),
      },
    },
    runTool('create_signup_form', async (args) => {
      const event = await getEventOrThrow(args.eventSlug)
      if (event.signupMode === 'none') {
        throw new AgentError(
          409,
          `Sign-up is not enabled for "${event.slug}". Set its signupMode to "event" or "session" first.`
        )
      }
      const targets = getSignupTargets(event)
      const sessionId = args.sessionId?.trim() ?? ''
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
        ...parseOpenTimes(args.openFrom, args.openUntil),
        pools: parsePools(args.pools),
        inputs: parseFields(args.fields),
        confirmedMessage: optionalString(args.confirmedMessage, 'confirmedMessage'),
        confirmedLink: optionalString(args.confirmedLink, 'confirmedLink'),
      })
      return { form: describeForm(form, target) }
    })
  )

  server.registerTool(
    'update_signup_form',
    {
      title: 'Update sign-up form',
      description: 'Changes only the given fields of a sign-up form.',
      inputSchema: {
        key: z.string().describe('Key of the form, from get_signup_forms'),
        ...z.object(formFields).partial().shape,
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    runTool('update_signup_form', async (args) => {
      const form = await getFormOrThrow(args.key)

      const pools = args.pools === undefined ? form.pools : parsePools(args.pools, form.pools)
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
        ...parseOpenTimes(args.openFrom ?? form.openfrom, args.openUntil ?? form.openuntil),
        pools,
        inputs: args.fields === undefined ? form.inputs : parseFields(args.fields),
        // An empty string or null removes the message or link
        confirmedMessage:
          args.confirmedMessage === undefined
            ? form.confirmedMessage
            : optionalString(args.confirmedMessage, 'confirmedMessage'),
        confirmedLink:
          args.confirmedLink === undefined
            ? form.confirmedLink
            : optionalString(args.confirmedLink, 'confirmedLink'),
      })
      return { form: describeForm(updated) }
    })
  )

  server.registerTool(
    'delete_signup_form',
    {
      title: 'Delete sign-up form',
      description: 'Deletes a sign-up form. Only forms without sign-ups can be deleted.',
      inputSchema: { key: z.string().describe('Key of the form, from get_signup_forms') },
      annotations: { destructiveHint: true },
    },
    runTool('delete_signup_form', async ({ key }) => {
      const form = await getFormOrThrow(key)
      if (totalSignups(form) > 0) throw participantsError([form], 'delete the sign-up form')
      await deleteSignupForms([form.key])
      return { deleted: form.key }
    })
  )
}
