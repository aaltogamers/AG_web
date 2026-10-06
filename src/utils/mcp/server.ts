// MCP server for the AI agent (/api/mcp). See "AI agent MCP server" in README.md.
import type { NextApiRequest } from 'next'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { timingSafeEqualStr } from '../adminSession'
import { AgentError } from '../agentApi'
import { getHeader } from '../apiUtils'
import { ensureMigrated } from '../db_pg'
import { registerEventTools } from './eventTools'
import { registerSignupFormTools } from './signupFormTools'
import { registerTaskTools } from './taskTools'

// `Authorization: Bearer <AGENT_API_KEY>`. The MCP server is disabled if the key isn't set.
export const isAgentAuthorized = (req: NextApiRequest): boolean => {
  const key = process.env.AGENT_API_KEY
  const header = getHeader(req, 'authorization')
  if (!key || !header?.startsWith('Bearer ')) return false
  return timingSafeEqualStr(header.slice('Bearer '.length).trim(), key)
}

const textResult = (text: string, isError = false): CallToolResult => ({
  content: [{ type: 'text', text }],
  ...(isError && { isError }),
})

// Runs a tool and answers with its result as JSON, or with an error message
// the agent can act on
export const runTool =
  <Args>(name: string, run: (args: Args) => Promise<Record<string, unknown>>) =>
  async (args: Args): Promise<CallToolResult> => {
    try {
      await ensureMigrated()
      const result = await run(args)
      return { ...textResult(JSON.stringify(result)), structuredContent: result }
    } catch (err) {
      if (err instanceof AgentError) return textResult(err.message, true)
      console.error(`[mcp] ${name} failed:`, err)
      return textResult('Internal error', true)
    }
  }

// Leaves out arguments that weren't given, so that the parsers only see given fields
export const givenArgs = (args: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined))

export const createMcpServer = () => {
  const server = new McpServer(
    { name: 'aaltogamers', title: 'Aalto Gamers', version: '1.0.0' },
    {
      instructions:
        'Manages Aalto Gamers events, their sign-up forms and the task board. ' +
        'Times are Helsinki wall-clock times like 2026-10-24T18:00, unless they have an offset. ' +
        'Event changes are visible on aaltogamers.fi after the site has been rebuilt, in 2-3 minutes. ' +
        'When telling the user about an event, sign-up form or task, link it with the url (or taskBoardUrl) from the tool result.',
    }
  )
  registerEventTools(server)
  registerSignupFormTools(server)
  registerTaskTools(server)
  return server
}
