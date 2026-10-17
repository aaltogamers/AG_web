import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  AGENT,
  describeChannel,
  describeExamplePost,
  describePost,
  describePreview,
  parsePostArgs,
} from '../agentPosts'
import { AgentError, formatAgentTime, parseAgentTime } from '../agentApi'
import { getPostHistory, getPostOrThrow, getSettings, listChannels, listPosts, listSentPosts } from '../postStore'
import { createPostAction, deletePost, editPost, requestApproval, withdrawApproval } from '../social/actions'
import { isDiscordConfigured, listGuildRoles } from '../social/discord'
import { buildPreview } from '../social/preview'
import { PLACEHOLDER_HELP } from '../social/render'
import { POST_STATUSES } from '../social/types'
import { sessionSchema } from './eventTools'
import { givenArgs, runTool } from './server'

const TIME_HINT = 'Helsinki time, e.g. 2026-10-24T18:00'

const imageSchema = z.object({
  url: z.string().optional().describe('An image to download, e.g. a poster'),
  sitePath: z
    .string()
    .optional()
    .describe("An existing image: an event's image (from get_event) or a site image like /images/foo.png"),
  mediaId: z.string().optional().describe('An image the post already has, from get_post'),
})

const channelSchema = z.object({
  channelId: z.string().describe('From list_channels'),
  sendAt: z
    .string()
    .nullable()
    .optional()
    .describe(`Own send time of this channel. ${TIME_HINT}. Leave out to use the post's sendAt.`),
  bodyOverride: z
    .string()
    .nullable()
    .optional()
    .describe("This channel's own text instead of the post's body (markdown)"),
  footerOverride: z
    .string()
    .nullable()
    .optional()
    .describe("Footer instead of the channel's default footer; an empty string for no footer"),
  pings: z
    .array(z.string())
    .optional()
    .describe(
      'Discord only: who the message pings, put before the text: "here", "everyone" or role ids from list_channels\' discordRoles. Defaults to ["here"] for a new Discord channel of the post; [] pings no one.'
    ),
})

const websiteChangeSchema = z.object({
  kind: z
    .enum(['create_event', 'update_event'])
    .describe('create_event makes a new event; update_event changes an existing one'),
  eventSlug: z.string().optional().describe('The event to change (update_event)'),
  timing: z
    .enum(['on_approval', 'before_post', 'at'])
    .optional()
    .describe(
      'When the change is made: on_approval (right when a human approves the post), before_post (the lead time, by default 10 minutes, before the first message) or at (runAt). Defaults to at when runAt is given, otherwise on_approval.'
    ),
  runAt: z
    .string()
    .optional()
    .describe(`When the change is made, with the timing "at". ${TIME_HINT}.`),
  event: z
    .object({
      name: z.string().optional(),
      sessions: z
        .array(sessionSchema)
        .optional()
        .describe(
          'All sessions after the change. Keep existing sessions with their ids; new sessions get an id when the post is saved (see get_post).'
        ),
      signupMode: z.enum(['none', 'event', 'session']).optional(),
      image: z
        .union([
          z.object({ postImage: z.number().int().describe("Position of one of the post's images, from 0") }),
          z.object({
            sitePath: z.string().describe("Another event's image (from get_event) or a site image like /images/foo.png"),
          }),
        ])
        .nullable()
        .optional(),
      visibleOnCalendar: z.boolean().optional(),
      visibleOnEventsPage: z.boolean().optional(),
      description: z.string().optional().describe('Short description (markdown)'),
      descriptionFromPost: z.boolean().optional().describe("Use the post's body as the short description"),
      body: z.string().optional().describe('Long description (markdown). Empty: the short description'),
      bodyFromPost: z.boolean().optional().describe("Use the post's body as the long description"),
    })
    .describe(
      'For create_event, the new event (name and description are required). For update_event, only the fields to change.'
    ),
})

const postFields = {
  title: z.string().describe('Short name of the post, only shown to admins'),
  body: z
    .string()
    .describe(
      `The text in markdown, written like the posts from get_example_posts and as short as possible while still interesting and informative. Placeholders, filled in for each channel: ${PLACEHOLDER_HELP}`
    ),
  eventSlug: z.string().nullable().describe('The event the post is about, for {{event}} and {{signup}}'),
  sendAt: z.string().nullable().describe(`Default send time of all channels. ${TIME_HINT}`),
  sendOnApproval: z
    .boolean()
    .describe('Send the channels without their own sendAt right when a human approves the post, instead of at sendAt'),
  images: z.array(imageSchema).describe('Up to 10 images; Instagram needs at least one. Replaces all images.'),
  channels: z
    .array(channelSchema)
    .describe('Where the post goes. Replaces all channels; channels already sent to are kept as they are.'),
  websiteChange: websiteChangeSchema
    .nullable()
    .describe(
      'A scheduled change to the website made before the messages go out: a new event, or changes to an existing one. Sign-up forms are not part of it: make them with create_signup_form / update_signup_form once the event exists. Replaces the whole website change; null removes it.'
    ),
}
const optionalPostFields = z.object(postFields).partial().shape

export const registerPostTools = (server: McpServer) => {
  server.registerTool(
    'list_channels',
    {
      title: 'List post channels',
      description:
        'Lists the Telegram, Discord and Instagram channels posts can be sent to, and the Discord roles a message can ping. The bot can\'t post to channels with forwardedByHand: their message goes to the review topic for a human to forward, so their footer usually links to our Telegram.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    runTool('list_channels', async () => {
      const [channels, settings] = await Promise.all([listChannels(), getSettings()])
      const discordRoles =
        settings.discord.guildId && isDiscordConfigured()
          ? await listGuildRoles(settings.discord.guildId)
              .then((roles) => roles.map(({ id, name }) => ({ id, name })))
              .catch(() => undefined)
          : undefined
      return { channels: channels.filter((c) => c.enabled).map(describeChannel), discordRoles }
    })
  )

  server.registerTool(
    'list_posts',
    {
      title: 'List posts',
      description:
        'Lists scheduled marketing posts with their channels and statuses, newest first. from / to filter by send times.',
      inputSchema: {
        statuses: z.array(z.enum(POST_STATUSES)).optional(),
        from: z.string().optional().describe(TIME_HINT),
        to: z.string().optional().describe(TIME_HINT),
        eventSlug: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    runTool('list_posts', async ({ statuses, from, to, eventSlug }) => {
      const [posts, channels] = await Promise.all([
        listPosts({
          statuses,
          eventSlug,
          from: from ? parseAgentTime(from, 'from').toISOString() : undefined,
          to: to ? parseAgentTime(to, 'to').toISOString() : undefined,
        }),
        listChannels(),
      ])
      return { posts: await Promise.all(posts.map((p) => describePost(p, channels))) }
    })
  )

  server.registerTool(
    'get_example_posts',
    {
      title: 'Get example posts',
      description:
        "Gets the most recently sent posts with their markdown text, channels, pings, footers and send times. Call it before writing a post and write the new one the same way: the same structure, tone, emoji, length and language(s), the same way of giving the time, place and sign-up link, and the same choice of channels, pings, footers and send times for a similar post (e.g. an announcement, a reminder the day before or a post on the day). Keep it as short as possible while still interesting and informative, even if an example is longer. Each channel's default footer is in list_channels.",
      inputSchema: {
        limit: z.number().int().min(1).max(30).optional().describe('How many posts, by default 10'),
      },
      annotations: { readOnlyHint: true },
    },
    runTool('get_example_posts', async ({ limit }) => {
      const [posts, channels] = await Promise.all([listSentPosts(limit ?? 10), listChannels()])
      return {
        posts: posts.map((p) => describeExamplePost(p, channels)),
        ...(!posts.length && {
          note: 'No posts have been sent yet. Ask the user for an example of how their posts look before writing one.',
        }),
      }
    })
  )

  server.registerTool(
    'get_post',
    {
      title: 'Get post',
      description:
        'Gets a post with its text, channels, website change and history.',
      inputSchema: { postId: z.string() },
      annotations: { readOnlyHint: true },
    },
    runTool('get_post', async ({ postId }) => {
      const post = await getPostOrThrow(postId)
      const [channels, history] = await Promise.all([listChannels(), getPostHistory(post.id)])
      return { post: await describePost(post, channels, { full: true, history }) }
    })
  )

  server.registerTool(
    'create_post',
    {
      title: 'Create post',
      description:
        'Creates a draft of a marketing post to Telegram, Discord and Instagram channels, optionally with a scheduled website change. Write it like the posts from get_example_posts. Check it with preview_post, then ask a human to approve it with request_approval. Nothing is sent before a human approves it.',
      inputSchema: { ...optionalPostFields, title: postFields.title, body: postFields.body },
    },
    runTool('create_post', async (args) => {
      const post = await createPostAction(await parsePostArgs(givenArgs(args)), AGENT)
      return {
        post: await describePost(post, await listChannels(), { full: true }),
        note: 'Saved as a draft. Check it with preview_post, then call request_approval. Link the post to the user.',
      }
    })
  )

  server.registerTool(
    'update_post',
    {
      title: 'Update post',
      description:
        'Changes only the given fields of a post. Editing a post that is awaiting approval or approved sends a new review, and an approved post is taken off the schedule until a human approves it again.',
      inputSchema: { postId: z.string(), ...optionalPostFields },
      annotations: { idempotentHint: true },
    },
    runTool('update_post', async ({ postId, ...fields }) => {
      const input = await parsePostArgs(givenArgs(fields))
      if (!Object.keys(input).length) throw new AgentError(400, 'Nothing to update')
      const { post, note } = await editPost(postId, input, AGENT)
      return {
        post: await describePost(post, await listChannels(), { full: true }),
        ...(note && { note }),
      }
    })
  )

  server.registerTool(
    'preview_post',
    {
      title: 'Preview post',
      description:
        "Shows each channel's text exactly as it will be sent, with character counts and limit problems, and the website change as a diff. A post with errors can't be approved.",
      inputSchema: { postId: z.string() },
      annotations: { readOnlyHint: true },
    },
    runTool('preview_post', async ({ postId }) => {
      const post = await getPostOrThrow(postId)
      return { postId: post.id, version: post.version, preview: describePreview(await buildPreview(post)) }
    })
  )

  server.registerTool(
    'request_approval',
    {
      title: 'Request approval',
      description:
        'Asks a human to approve a draft: sends a review with Approve / Reject buttons to the review topic in Telegram. Only a human can approve; after approval the post is sent at its times.',
      inputSchema: { postId: z.string() },
    },
    runTool('request_approval', async ({ postId }) => {
      const { post, note } = await requestApproval(postId, AGENT)
      return { post: await describePost(post, await listChannels()), note }
    })
  )

  server.registerTool(
    'withdraw_approval_request',
    {
      title: 'Withdraw approval request',
      description: 'Takes a post that is awaiting approval back to draft.',
      inputSchema: { postId: z.string() },
    },
    runTool('withdraw_approval_request', async ({ postId }) => {
      const post = await withdrawApproval(postId, AGENT)
      return { post: await describePost(post, await listChannels()), at: formatAgentTime(new Date()) }
    })
  )

  server.registerTool(
    'delete_post',
    {
      title: 'Delete post',
      description:
        'Deletes a draft or a post awaiting approval that the AI agent made, with its website change. Posts made by a human, and approved or sent posts, can only be deleted by a human.',
      inputSchema: { postId: z.string() },
      annotations: { destructiveHint: true },
    },
    runTool('delete_post', async ({ postId }) => {
      await deletePost(postId, AGENT)
      return { deleted: postId }
    })
  )
}
