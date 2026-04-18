declare module '*.md' {
  const attributes: { [key: string]: string | string[] | {}[] }
  const react: React.FC<attributes>
  export { attributes, react }
}

declare module 'node-pg-migrate' {
  interface RunnerOptions {
    databaseUrl: string | { connectionString?: string; ssl?: unknown }
    dir: string | string[]
    direction: 'up' | 'down'
    migrationsTable: string
    singleTransaction?: boolean
    log?: (msg: string) => void
    [key: string]: unknown
  }
  export function runner(options: RunnerOptions): Promise<unknown>
}
