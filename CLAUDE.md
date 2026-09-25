Run type check with

```bash
npm run type-check
```

Run lint with

```bash
npm run lint
```

There are no unit or E2E tests, and you should not add them.

## AI agent API

`/api/agent/**` (see "AI agent API" in README.md) exposes events, sign-up forms and tasks to an n8n AI agent. Keep it in sync with the rest of the site:

- Put sign-up form and task database logic in `src/utils/signupForms.ts` and `src/utils/taskStore.ts`, which both the regular and the agent endpoints use, not in the route handlers.
- When event fields change (`public/cms/config.yml`), update `src/utils/agentEvents.ts` and `src/utils/eventFiles.ts` (field order, session ids like the `preSave` handler in `public/cms/index.html`).
- When agent endpoints or their fields change, update the tool descriptions in `n8n/ag-agent-workflow.json`, since the agent only knows what they say.
- The agent API must never return participants' answers, only counts.
