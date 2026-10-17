// TEMPORARY: imports event files (the old src/content/events/*.md) and their
// images into the database, all or nothing. Used when the server starts
// (startupMigrations.ts) and by scripts/importEvents.ts. Remove with the event
// files once production has its events.
import pool, { withTransaction } from './db_pg'
import { eventsChanged, getEvent, saveEvent, validateEvent } from './eventStore'
import { parseMarkdown } from './fileUtils'
import { uploadEventImage } from './mediaStore'

export type EventFileSource = {
  // Event files as { slug, text }
  list: () => Promise<{ slug: string; text: string }[]>
  // An image by its site path, e.g. /images/foo.png
  readImage: (sitePath: string) => Promise<Buffer>
}

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

// Creates the events, or updates the ones that differ. Throws, saving nothing,
// if any event fails validation or its image can't be read.
export const importEvents = async (source: EventFileSource, log = console.log) => {
  const uploaded = new Map<string, string>()
  const failures: string[] = []
  const events: { slug: string; data: Record<string, unknown>; body: string }[] = []

  // Images first, outside the transaction; they are named by their hash, so a
  // second try uploads nothing again
  for (const { slug, text } of await source.list()) {
    try {
      const { data: parsed, content } = parseMarkdown(text)
      const data: Record<string, unknown> = { ...parsed }
      if (typeof data.image === 'string' && data.image) {
        const sitePath = data.image
        if (!uploaded.has(sitePath)) uploaded.set(sitePath, await uploadEventImage(await source.readImage(sitePath)))
        data.image = uploaded.get(sitePath)
      }
      events.push({ slug, data: validateEvent(data), body: content.trim() })
    } catch (err) {
      failures.push(`${slug}: ${err instanceof Error ? err.message : err}`)
    }
  }
  if (failures.length) throw new Error(`Events that can't be imported:\n${failures.join('\n')}`)

  const counts = { created: 0, updated: 0, unchanged: 0 }
  await withTransaction(async (client) => {
    for (const event of events) {
      const existing = await getEvent(event.slug, client)
      if (existing && canonical(existing.data) === canonical(event.data) && existing.body === event.body) {
        counts.unchanged++
        continue
      }
      await saveEvent({ ...event, version: existing?.version ?? null, author: 'import' }, client)
      counts[existing ? 'updated' : 'created']++
    }
  })
  eventsChanged()
  log(`[events] imported ${events.length} events: ${JSON.stringify(counts)}`)
  return counts
}

// Whether events have ever been saved, i.e. the import has run
export const hasEvents = async () => {
  const result = await pool.query<{ any: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM events) OR EXISTS (SELECT 1 FROM event_revisions) AS any'
  )
  return result.rows[0].any
}
