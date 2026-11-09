import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { AgentError } from '../agentApi'
import { redirectLinkTargets } from '../linkTargets'
import { TaggedLink, qrPageUrl } from '../taggedLinks'
import {
  createTaggedLink,
  deleteTaggedLink,
  getTaggedLink,
  listTaggedLinks,
  renameTaggedLink,
  withStats,
} from '../taggedLinkStore'
import { runTool } from './server'

const describe = (link: TaggedLink) => ({ ...link, qrCodePage: qrPageUrl(link.id) })

const notFound = (id: string) => new AgentError(404, `No tagged link with id "${id}"`)

export const registerLinkTools = (server: McpServer) => {
  server.registerTool(
    'list_tagged_links',
    {
      title: 'List tagged links',
      description:
        'Lists the tagged links with their visitor counts (last 30 days and all time; null if unavailable or the link is outside aaltogamers.fi), and the redirect links (aaltogamers.fi/link/<slug>) that can be tagged.',
      annotations: { readOnlyHint: true },
    },
    runTool('list_tagged_links', async () => ({
      taggedLinks: (await withStats(await listTaggedLinks())).map((l) => ({
        ...describe(l),
        stats: l.stats,
      })),
      redirectLinks: redirectLinkTargets().map(({ name, url }) => ({ name, url })),
    }))
  )

  server.registerTool(
    'create_tagged_link',
    {
      title: 'Create tagged link',
      description:
        'Saves a link with a statistics tag (added as ?ref=<tag>), to see how many people arrived through it, e.g. from a poster. A human makes its QR code on qrCodePage. The url and tag cannot be changed later.',
      inputSchema: {
        name: z.string().describe('e.g. "Discord – Otaniemi poster"'),
        url: z
          .string()
          .describe(
            'Full URL without the tag, e.g. a redirect link like https://aaltogamers.fi/link/discord or an event page'
          ),
        tag: z
          .string()
          .optional()
          .describe(
            'Lowercase letters, numbers, - and _, e.g. otaniemi-events. By default made from the name.'
          ),
      },
    },
    runTool('create_tagged_link', async (args) => ({
      taggedLink: describe(await createTaggedLink(args)),
    }))
  )

  server.registerTool(
    'rename_tagged_link',
    {
      title: 'Rename tagged link',
      inputSchema: { id: z.string(), name: z.string() },
      annotations: { idempotentHint: true },
    },
    runTool('rename_tagged_link', async ({ id, name }) => {
      const link = await renameTaggedLink(id, name)
      if (!link) throw notFound(id)
      return { taggedLink: describe(link) }
    })
  )

  server.registerTool(
    'delete_tagged_link',
    {
      title: 'Delete tagged link',
      description:
        'Deletes a saved tagged link. Its QR codes keep working, but it no longer shows in the list.',
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    runTool('delete_tagged_link', async ({ id }) => {
      if (!(await getTaggedLink(id))) throw notFound(id)
      await deleteTaggedLink(id)
      return { deleted: true }
    })
  )
}
