// Imports the event files (src/content/events/*.md) and their images of a git
// ref into the database, e.g. the tag made before events moved there:
//   npm run import-events -- --ref pre-db-events
// `npm run seed-events` does the same for a local database. Against production,
// set DATABASE_URL, MEDIA_STORAGE_CONNECTION_STRING and NODE_ENV=production (for SSL).
// Images are uploaded with uploadEventImage, so running it again uploads nothing
// new and only updates events whose file differs from their row.
import { execFileSync } from 'child_process'
import pool, { ensureMigrated } from '../src/utils/db_pg'
import { getEvent, saveEvent, validateEvent } from '../src/utils/eventStore'
import { parseMarkdown } from '../src/utils/fileUtils'
import { uploadEventImage } from '../src/utils/mediaStore'

const EVENTS_DIR = 'src/content/events'

const refArg = process.argv.indexOf('--ref')
const ref = refArg > 0 ? process.argv[refArg + 1] : undefined
if (!ref) {
  console.error('Usage: tsx scripts/importEvents.ts --ref <git ref>')
  process.exit(1)
}

const git = (args: string[]) => execFileSync('git', args, { maxBuffer: 100 * 1024 * 1024 })

// JSON with sorted keys, since jsonb doesn't keep their order
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
          .join(',')}}`
      : JSON.stringify(value)

const uploaded = new Map<string, string>()

// The image's media URL, from the image file in the ref
const importImage = async (sitePath: string) => {
  const known = uploaded.get(sitePath)
  if (known) return known
  if (!sitePath.startsWith('/') || sitePath.includes('..')) throw new Error(`Image "${sitePath}" is not a site path`)
  let file: Buffer
  try {
    file = git(['show', `${ref}:public${sitePath}`])
  } catch {
    throw new Error(`Image ${sitePath} is not in ${ref}`)
  }
  const url = await uploadEventImage(file)
  uploaded.set(sitePath, url)
  return url
}

const main = async () => {
  await ensureMigrated()
  const names = git(['ls-tree', '--name-only', `${ref}:${EVENTS_DIR}`])
    .toString('utf8')
    .split('\n')
    .filter((name) => name.endsWith('.md'))
  console.log(`Importing ${names.length} events from ${ref}`)
  const counts = { created: 0, updated: 0, unchanged: 0, failed: 0 }

  for (const name of names) {
    const slug = name.slice(0, -3)
    try {
      const { data: parsed, content } = parseMarkdown(git(['show', `${ref}:${EVENTS_DIR}/${name}`]).toString('utf8'))
      const data: Record<string, unknown> = { ...parsed }
      if (typeof data.image === 'string' && data.image) data.image = await importImage(data.image)
      const body = content.trim()
      const existing = await getEvent(slug)
      if (
        existing &&
        canonical(existing.data) === canonical(validateEvent(data)) &&
        existing.body === body
      ) {
        counts.unchanged++
        continue
      }
      await saveEvent({ slug, data, body, version: existing?.version ?? null, author: 'import' })
      counts[existing ? 'updated' : 'created']++
      console.log(`${existing ? 'Updated' : 'Created'} ${slug}`)
    } catch (err) {
      counts.failed++
      console.error(`FAILED ${slug}: ${err instanceof Error ? err.message : err}`)
    }
  }
  console.log(counts)
  await pool.end()
  if (counts.failed) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
