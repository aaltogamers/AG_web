## Aalto Gamers Website 2.0

Made using React, Next.js and Netlify CMS

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
