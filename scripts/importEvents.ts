// Imports the event files (src/content/events/*.md) and their images of a git
// ref into the database, e.g. to seed a local database:
//   npm run import-events -- --ref <git ref>
// Running it again only updates events whose file differs from their row.
import { execFileSync } from 'child_process'
import pool, { ensureMigrated } from '../src/utils/db_pg'
import { importEvents } from '../src/utils/eventImport'

const EVENTS_DIR = 'src/content/events'

const refArg = process.argv.indexOf('--ref')
const ref = refArg > 0 ? process.argv[refArg + 1] : undefined
if (!ref) {
  console.error('Usage: tsx scripts/importEvents.ts --ref <git ref>')
  process.exit(1)
}

const git = (args: string[]) => execFileSync('git', args, { maxBuffer: 100 * 1024 * 1024 })

const main = async () => {
  await ensureMigrated()
  await importEvents({
    list: async () =>
      git(['ls-tree', '--name-only', `${ref}:${EVENTS_DIR}`])
        .toString('utf8')
        .split('\n')
        .filter((name) => name.endsWith('.md'))
        .map((name) => ({
          slug: name.slice(0, -3),
          text: git(['show', `${ref}:${EVENTS_DIR}/${name}`]).toString('utf8'),
        })),
    readImage: async (sitePath) => {
      if (!sitePath.startsWith('/') || sitePath.includes('..')) throw new Error(`"${sitePath}" is not a site path`)
      try {
        return git(['show', `${ref}:public${sitePath}`])
      } catch {
        throw new Error(`Image ${sitePath} is not in ${ref}`)
      }
    },
  })
  await pool.end()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
