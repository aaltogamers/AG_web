import type { NextApiRequest, NextApiResponse } from 'next'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer, isAgentAuthorized } from '../../utils/mcp/server'

// Stateless Streamable HTTP MCP server for the AI agent: every request gets
// its own server, and responses are plain JSON. See "AI agent MCP server" in README.md.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!isAgentAuthorized(req)) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: null,
    })
  }
  // There are no server-initiated messages to stream, and no sessions to end
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' },
      id: null,
    })
  }

  const server = createMcpServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  res.on('close', () => {
    transport.close()
    server.close()
  })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('[mcp] request failed:', err)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: null,
      })
    }
  }
}

export default handler
