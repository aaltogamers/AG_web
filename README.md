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

The database starts without events. Import them from the last commit that had
event files (see "Events and images" below): `npm run seed-events` (needs the
`pre-db-events` tag: `git fetch --tags`).

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
- `MEDIA_STORAGE_CONNECTION_STRING`, `MEDIA_BASE_URL` — the Blob Storage
  account for uploaded images and the public URL of its `media` container
  (set by `infra/main.tf`). Without them, uploads go to `public/media` and
  are served from `/media`, e.g. in development.

### Events and images

Events are in Postgres (`events`), not in git, so every change is on the site
right away. They are edited in the "Events" admin tab (`/admin/events`), by
the MCP server and by the website changes of scheduled posts, all through
`src/utils/eventStore.ts`. Each save needs the version it was made on, so
nobody saves over someone else's change. Every save and delete is also
written to `event_revisions` (with who made it), for undoing a bad edit by
hand; database backups (35 days) cover the rest. The pages read the events
from an in-memory list that is reloaded after every change and every 60 s.

In the event editor, an event's sign-up forms (`&signup=<key>`) and posts
(`&post=<id>`) are listed, opened and added. Adding a form for the whole event
or for a session sets the event's `signupMode`; an event has one kind at a time.

Uploaded images (event images and post images) are in Blob Storage, through
`src/utils/mediaStore.ts`. An event image is stored as WebP for the site and
as the original without metadata, named by its hash, and never deleted.
Sign-up uploads stay in Postgres, since they are participants' answers.

Events were files in `src/content/events` until the tag `pre-db-events`.
`npm run import-events -- --ref <git ref>` imports the event files and their
images of a git ref, e.g. into a local database; running it again only updates
events that differ. `npm run seed-events` imports the tag `pre-db-events`.

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
changes show on the site right away. Tools are defined in `src/utils/mcp/`.

The post tools only make drafts and ask for approval; the agent can never
approve, schedule or send a post. It can delete its own drafts and posts
awaiting approval, but not posts made by a human. The agent is told to read the most recently
sent posts (`get_example_posts`) first and write new posts the same way.

### Scheduled posts

The "Calendar" admin tab (`/admin/posts`) shows posts together with the
events' sessions and when their sign-ups open and close; posts are also
listed in the event editor. Posts go to Telegram, Discord and Instagram
channels. A post is written once in Markdown and rendered for
each channel, with the placeholders `{{link:<name>}}` (a `/link/<name>`
redirect), `{{event}}`, `{{signup}}` and `{{signup:<session name>}}`, all with
`?ref=<channel ref>`, and `{{date}}`, `{{time}}`, `{{location}}` and
`{{signupOpens}}` of the event's next session at the send time (or
`{{date:<session name>}}` etc.; dates are "today" or "tomorrow" when they are).
Each channel can have its own send time, footer or text, and Discord channels
pings (`@here` by default). Discord messages have no link previews, and neither
do Telegram messages; Instagram shows links as their text. A post can be sent
right when it is approved instead of at a time. "Duplicate" makes a copy of a
post without its times or website change, e.g. for a reminder.

A post's images are uploads or "Use event image", the image the post's event
has when the post is sent (or the one its website change gives the event). A
post can have a responsible Telegram user (from those who have opened the task
board), and "Should have an image" with someone who makes it; such a post can't
be approved without an image. Until a post with a send time is approved, the
review topic is reminded 5, 2 and 1 days before its first message
(`src/utils/social/reminders.ts`), mentioning the responsible user, and the
image maker while the post has no image.

A post can include one website change (creating or changing an event; its
sign-up forms are edited in the event editor), which runs when the post is
approved (default), 10 minutes before the first message, or at a set time. It
runs in one transaction, so it either happens fully or not at all. If it
fails, e.g. because the same fields were edited in the event editor, the messages wait
until someone presses Retry (overwrites) or Send anyway.

Only the approved version of a post is sent; any edit needs a new approval, on
the website or with the posts bot's buttons in the review topic. On the website,
"Back to draft" takes a post off the schedule and "Delete post" deletes it
(unsent messages and website changes are not sent). The scheduler
(`src/utils/social/scheduler.ts`) runs every 60 s, retries failed sends up to 3
times and reports failures in the review topic. Messages more than 30 minutes
late are reported instead of sent.

A Telegram channel or group the bot can't post to can be added as "Forwarded by
hand". When its message is due, the bot sends it to the review topic, with a
reply asking someone to forward it there with "Hide sender name" (so it doesn't
show the bot or our channel as the sender) and a "✅ Forwarded" button that
anyone in the review topic can press. Give it a footer like
`Join us: {{link:telegram}}` and its own ref.

The settings can have one Telegram and one Discord test channel. They aren't
channels, so posts can't pick them; "Post on test channel" in the editor's
preview sends the open Telegram or Discord tab's text (with the images) there,
right away and without approval. On Discord the pings are written out as
"Would ping @here and @Role" instead of pinging. Only on the website, not
through the MCP server.

Settings (`/admin/posts/settings`): the review chat, the approvers (Telegram
users who can press the buttons), the Discord server, the test channels and the channels. Posts bot commands, for approvers:

- `/review_here` — reviews go to this group or topic. Not in channels, since
  channel posts don't say who sent them.
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
   `/register` there (in the right topic), and add it as a channel. Chats the
   bot can't be added to can be added as "Forwarded by hand" instead.
5. Discord: create a bot at discord.com/developers and invite it to the server
   with View Channels, Send Messages, Embed Links, Attach Files and Mention
   @everyone, @here and All Roles. Set
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

The CMS at `/cms` edits the other pages (about, partners...); events have
their own editor (see "Events and images"). It is Decap CMS **3.16.3**, served from prebuilt files in
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
