// TEMPORARY data migrations, run when the server starts so production needs no
// manual steps: importing the event files shipped in the Docker image (only
// into an empty database) and moving old post images to mediaStore. Remove this,
// its call in instrumentation.ts, the event files and their lines in Dockerfile
// and .dockerignore once production has run them.
import fs from 'fs/promises'
import path from 'path'
import pool, { ensureMigrated } from './db_pg'
import { hasEvents, importEvents } from './eventImport'
import { moveOldPostMedia } from './postStore'

// Any number; only one instance runs the migrations at a time
const LOCK_ID = 724_610_001

const EVENTS_DIR = path.join(process.cwd(), 'src', 'content', 'events')
// The original images: copied here in the Docker image (public/ there only has
// .webp versions), and in public/ in development
const IMAGE_ROOTS = [path.join(process.cwd(), 'event-import-images'), path.join(process.cwd(), 'public')]

const importEventFiles = async () => {
  if (await hasEvents()) return
  const names = (await fs.readdir(EVENTS_DIR).catch(() => [])).filter((name) => name.endsWith('.md'))
  if (!names.length) return
  await importEvents({
    list: () =>
      Promise.all(
        names.map(async (name) => ({
          slug: name.slice(0, -3),
          text: await fs.readFile(path.join(EVENTS_DIR, name), 'utf8'),
        }))
      ),
    readImage: async (sitePath) => {
      if (!sitePath.startsWith('/') || sitePath.includes('..')) throw new Error(`"${sitePath}" is not a site path`)
      for (const root of IMAGE_ROOTS) {
        const data = await fs.readFile(path.join(root, sitePath)).catch(() => null)
        if (data) return data
      }
      throw new Error(`Image ${sitePath} was not found`)
    },
  })
}

// The event import is awaited, so the site never shows an empty event list; the
// post images are moved in the background
export const runStartupMigrations = async () => {
  await ensureMigrated()
  const client = await pool.connect()
  try {
    const locked = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_ID])
    if (!locked.rows[0].ok) return
    try {
      await importEventFiles().catch((err) => console.error('[startup] importing the event files failed:', err))
      await moveOldPostMedia().catch((err) => console.error('[startup] moving post images failed:', err))
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID])
    }
  } finally {
    client.release()
  }
}
