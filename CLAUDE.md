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
- When event fields change (the validation in `src/utils/eventStore.ts`), update `src/utils/agentEvents.ts` and the tool schemas in `src/utils/mcp/eventTools.ts`.
- The MCP server must never return participants' answers, only counts.
- The MCP server must never schedule, approve or send posts; only a human can approve them (on the website or with the Telegram buttons).

## Events and images

See "Events and images" in README.md.

- Put event database logic only in `src/utils/eventStore.ts`, and add, read or delete uploaded files only through `src/utils/mediaStore.ts`.
- Pages that show events read `getEvents()` in `getServerSideProps`.
- A new event field is a change to the validation in `eventStore.ts` (and the `events` CHECKs in a migration if it's required), the event editor (`src/components/events/EventEditor.tsx`) and the MCP schemas; old rows are handled by `normalizeEvent` or an `UPDATE ... jsonb_set` migration.

## Scheduled posts

See "Scheduled posts" in README.md.

- Put post, channel and settings database logic in `src/utils/postStore.ts`, and the rest of the post logic (rendering, sending, website changes, the review topic, approval) in `src/utils/social/`, not in the route handlers, the webhook or the MCP tools.
- When the formatting, channel settings or website change options change, update the schemas in `src/utils/mcp/postTools.ts` and `src/utils/agentPosts.ts`.
- When event fields (`eventStore.ts`) or sign-up form fields change, also update the website change editor (`src/components/posts/WebsiteChangeEditor.tsx`, `postDraft.ts`), its validation (`postStore.ts`, `src/utils/social/website.ts`) and `postTools.ts`.
