Run type check with

```bash
npm run type-check
```

Run lint with

```bash
npm run lint
```

There are no unit or E2E tests, and you should not add them.

## AI agent MCP server

`/api/mcp` (see "AI agent MCP server" in README.md) is an MCP server that exposes events, sign-up forms and tasks to an AI agent. Its tools are in `src/utils/mcp/`. Keep it in sync with the rest of the site:

- Put sign-up form and task database logic in `src/utils/signupForms.ts` and `src/utils/taskStore.ts`, which both the regular endpoints and the MCP tools use, not in the route handlers or tools.
- When event fields change (`public/cms/config.yml`), update `src/utils/agentEvents.ts`, the tool schemas in `src/utils/mcp/eventTools.ts` and `src/utils/eventFiles.ts` (field order, session ids like the `preSave` handler in `public/cms/index.html`).
- The MCP server must never return participants' answers, only counts.
