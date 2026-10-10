## Aalto Gamers Website 2.0

Made using React, Next.js and Decap CMS

Node.js version 18+

### Option A: Local Node

Install packages and start the dev server:

```
npm install
npm run dev
```

This expects a Postgres reachable at the `DATABASE_URL` from `.env`. The easy
way to get one is to start only the database via compose:

```
docker compose up -d postgres
```

### Option B: Full stack with Docker Compose (recommended)

Spins up Postgres **and** the Next.js dev server (with hot reload) in
containers:

```
docker compose up
```

- App: http://localhost:3000
- Postgres: `postgresql://agweb:agweb@localhost:5432/agweb`

The app container bind-mounts the source tree, so edits on the host trigger
hot-reload inside the container. `node_modules` and `.next` live inside the
container to keep native deps (`sharp`, `pg`) matching the Linux runtime.

Migrations (`migrations/`) are applied automatically on first DB access by
`node-pg-migrate`. You can also run them manually:

```
docker compose exec web npm run migrate:up
```

To reset the database, stop compose and remove the volume:

```
docker compose down -v
```

### Environment variables

- `DATABASE_URL` — Postgres connection string.
- `ADMIN_PASSWORD` — admin password for the `/admin` page and the CMS. The
  server turns a correct password into a signed `ag_admin` cookie; all
  admin-gated API routes check that cookie.
- `ADMIN_SESSION_SECRET` — optional HMAC secret for the cookie. Defaults to
  `ADMIN_PASSWORD` if unset.
- `BET_BOT_SECRET` — shared secret the Twitch chat bot sends in the
  `x-bet-secret` header when POSTing to `/api/votes`. No one but the bot
  should know this.
- `AGENT_API_KEY` — key for the AI agent MCP server (see below). The MCP
  server is disabled if it is unset.
- `TELEGRAM_POSTS_BOT_TOKEN`, `TELEGRAM_POSTS_WEBHOOK_SECRET` (any random
  string), `DISCORD_BOT_TOKEN`, `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`
  (the first long-lived token) — scheduled posts (see below).
- `RCON_IP`, `RCON_PASSWORD`, `RCON_PORT` — Minecraft whitelist endpoint.
- `APP_ID`, `PRIVATE_KEY`, `INSTALLATION_ID` — GitHub App credentials for
  the Decap CMS auth handshake (`/api/auth`).

### Live data & APIs

Signups, map bans, and bets live in Postgres. Live updates to `/mapban`,
`/bet`, and `/betboard` use Server-Sent Events streamed from
`/api/stream/:topic` (`mapbans`, `polls`, `votes`).

### AI agent MCP server

`/api/mcp` is an [MCP](https://modelcontextprotocol.io) server (Streamable
HTTP transport, stateless, JSON responses) with tools for managing events,
their sign-up forms and the task board. Clients authenticate with
`Authorization: Bearer <AGENT_API_KEY>`. For example, in n8n use the MCP
Client Tool with "HTTP Streamable" and Bearer auth; in Claude Code run
`claude mcp add --transport http aaltogamers https://aaltogamers.fi/api/mcp --header "Authorization: Bearer <key>"`.

Tools return participants' sign-up counts, never their answers. Event
changes are committed to the repo, so they show on the site after the next
rebuild. Tools are defined in `src/utils/mcp/`.

The post tools only make drafts and ask for approval; the agent can never
approve, schedule or send a post.

### Scheduled posts

The "Posts" admin tab (`/admin/posts`) schedules posts to Telegram, Discord
and Instagram channels. A post is written once in Markdown and rendered for
each channel, with the placeholders `{{link:<name>}}` (a `/link/<name>`
redirect), `{{event}}`, `{{signup}}` and `{{signup:<session name>}}`, all with
`?ref=<channel ref>`. Each channel can have its own send time, footer or text.

A post can include one website change (creating or changing an event and its
sign-up forms), which runs before the messages (by default 10 minutes). If it
fails, e.g. because the same fields were edited in the CMS, the messages wait
until someone presses Retry (overwrites) or Send anyway.

Only the approved version of a post is sent; any edit needs a new approval, on
the website or with the posts bot's buttons in the review topic. The scheduler
(`src/utils/social/scheduler.ts`) runs every 60 s, retries failed sends up to 3
times and reports failures in the review topic. Messages more than 30 minutes
late are reported instead of sent.

Settings (`/admin/posts/settings`): the review chat, the approvers (Telegram
users who can press the buttons), the Discord server, the base URL and the
channels. Posts bot commands, for approvers:

- `/review_here` — reviews go to this chat or topic.
- `/register` — makes this chat or topic selectable as a channel (also chats
  the bot is added to). In a channel, any admin can send it.

#### Setting up

In production, set the env variables as GitHub Actions secrets and run the
"Infrastructure (OpenTofu)" workflow (see `infra/README.md`).

1. Create the posts bot with @BotFather and set `TELEGRAM_POSTS_BOT_TOKEN` and
   `TELEGRAM_POSTS_WEBHOOK_SECRET`.
2. In the settings: "Connect bot" (sets the webhook to
   `<base URL>/api/telegram/posts-webhook`, so the base URL must be public) and
   add yourself as an approver by numeric user id (e.g. from @userinfobot).
3. Add the bot to the review group, let it post, and send `/review_here` in the
   review topic.
4. Add the bot as an admin to each Telegram channel or group to post to, send
   `/register` there (in the right topic), and add it as a channel.
5. Discord: create a bot at discord.com/developers and invite it to the server
   with View Channels, Send Messages, Embed Links and Attach Files. Set
   `DISCORD_BOT_TOKEN`, enter the server id in the settings and add the
   channels. "Test" checks the bot's permissions.
6. Instagram: make the account a professional account. Create a Business app at
   developers.facebook.com with the Instagram product ("API setup with
   Instagram login"; development mode is fine), add the account as a tester,
   generate a token with `instagram_business_basic` and
   `instagram_business_content_publish`, and exchange it for a long-lived token.
   Set `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN`; the token is renewed
   automatically. Instagram fetches the images from this site, so it must be
   public.

### Content manager (Decap CMS)

The CMS at `/cms` is Decap CMS **3.16.3**, served from prebuilt files in
`public/cms/` (it is not an npm dependency). `config.yml` holds the CMS
config. To upgrade, run `npm pack decap-cms@<version>` and copy from its
`package/dist/`: `decap-cms.js`, all `*.decap-cms.js` chunks, the `*.wasm`
files and `decap-cms.js.LICENSE.txt`. Delete the old chunks first, since
their names change between versions.

`decap-cms.js` is patched: GitHub App tokens fail Decap's write-access check
("Your GitHub user account does not have access to this repo."), so that
check is disabled by changing
`&&!this.bypassWriteAccessCheckForAppTokens)throw` to
`&&this.bypassWriteAccessCheckForAppTokens)throw`. Re-apply this after
upgrading.
