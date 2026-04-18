import path from 'path'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
})

let migrationsPromise: Promise<void> | null = null

const runMigrations = async (): Promise<void> => {
  if (!process.env.DATABASE_URL) {
    console.warn('[db_pg] DATABASE_URL not set, skipping migrations')
    return
  }

  // Try a few candidate locations so migrations work both in dev (repo root)
  // and in the standalone Docker image (where they are copied next to server.js).
  const candidates = [
    path.join(process.cwd(), 'migrations'),
    path.join(process.cwd(), '..', 'migrations'),
    path.join(process.cwd(), '..', '..', 'migrations'),
  ]

  const fs = await import('fs')
  const dir = candidates.find((c) => {
    try {
      return fs.statSync(c).isDirectory()
    } catch {
      return false
    }
  })

  if (!dir) {
    console.warn('[db_pg] migrations directory not found, skipping migrations')
    return
  }

  const { runner } = await import('node-pg-migrate')

  await runner({
    databaseUrl:
      process.env.NODE_ENV === 'production'
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : process.env.DATABASE_URL,
    dir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: (msg: string) => console.log(`[migrate] ${msg}`),
    singleTransaction: true,
  })
}

export const ensureMigrated = (): Promise<void> => {
  if (!migrationsPromise) {
    migrationsPromise = runMigrations().catch((err) => {
      console.error('[db_pg] migration failed:', err)
      migrationsPromise = null
      throw err
    })
  }
  return migrationsPromise
}

export default pool
