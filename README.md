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
- `AGENT_API_KEY` — key for the AI agent API (see below). The agent API is
  disabled if it is unset.
- `RCON_IP`, `RCON_PASSWORD`, `RCON_PORT` — Minecraft whitelist endpoint.
- `APP_ID`, `PRIVATE_KEY`, `INSTALLATION_ID` — GitHub App credentials for
  the Decap CMS auth handshake (`/api/auth`).

### Live data & APIs

Signups, map bans, and bets live in Postgres. Live updates to `/mapban`,
`/bet`, and `/betboard` use Server-Sent Events streamed from
`/api/stream/:topic` (`mapbans`, `polls`, `votes`).

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
