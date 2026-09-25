// Reads and writes event markdown files in the GitHub repo, the same way
// Decap CMS does, so the AI agent API can manage events. Commits to the
// default branch trigger a new deployment, like publishing in the CMS.
// In development the local files are used instead, like Decap's local_backend.
import crypto from 'crypto'
import fs from 'fs/promises'
import jsYaml from 'js-yaml'
import slugify from 'slug'
import type { AGEvent } from '../types/types'
import { AgentError } from './agentApi'
import { normalizeEvent } from './eventUtils'
import { parseMarkdown } from './fileUtils'
import { getRepoOctokit, REPO_BRANCH, REPO_NAME, REPO_OWNER } from './github'

const EVENTS_DIR = 'src/content/events'

// Frontmatter keys in the order of the event fields in public/cms/config.yml
const FIELD_ORDER = [
  'name',
  'sessions',
  'signupMode',
  'image',
  'visibleOnCalendar',
  'visibleOnEventsPage',
  'description',
  'recordings',
]

export type EventFile = {
  slug: string
  data: Record<string, unknown>
  // Long description (markdown below the frontmatter)
  body: string
  // Blob sha, needed to update or delete the file
  sha: string
}

const repo = { owner: REPO_OWNER, repo: REPO_NAME }
const pathOf = (slug: string) => `${EVENTS_DIR}/${slug}.md`

const parseEventFile = (slug: string, text: string, sha: string): EventFile => {
  const { data, content } = parseMarkdown(text)
  return { slug, data: { ...data }, body: content.trim(), sha }
}

export const eventFromFile = (file: EventFile): AGEvent =>
  normalizeEvent({ ...file.data, content: file.body, slug: file.slug })

const isNotFound = (err: unknown) => (err as { status?: number })?.status === 404

const useLocalFiles = process.env.NODE_ENV !== 'production'

export const getEventFile = async (slug: string): Promise<EventFile | null> => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  if (useLocalFiles) {
    const text = await fs.readFile(pathOf(slug), 'utf8').catch(() => null)
    return text === null ? null : parseEventFile(slug, text, '')
  }
  const octokit = await getRepoOctokit()
  try {
    const res = await octokit.rest.repos.getContent({
      ...repo,
      path: pathOf(slug),
      ref: REPO_BRANCH,
    })
    if (Array.isArray(res.data) || res.data.type !== 'file') return null
    const text = Buffer.from(res.data.content, 'base64').toString('utf8')
    return parseEventFile(slug, text, res.data.sha)
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

type TreeQuery = {
  repository: {
    object: {
      entries: { name: string; oid: string; object: { text: string | null } | null }[]
    } | null
  }
}

// All event files with one request
export const listEventFiles = async (): Promise<EventFile[]> => {
  if (useLocalFiles) {
    const names = (await fs.readdir(EVENTS_DIR)).filter((name) => name.endsWith('.md'))
    return Promise.all(
      names.map(async (name) =>
        parseEventFile(name.slice(0, -3), await fs.readFile(`${EVENTS_DIR}/${name}`, 'utf8'), '')
      )
    )
  }
  const octokit = await getRepoOctokit()
  const result = await octokit.graphql<TreeQuery>(
    `query ($owner: String!, $name: String!, $expression: String!) {
      repository(owner: $owner, name: $name) {
        object(expression: $expression) {
          ... on Tree {
            entries { name oid object { ... on Blob { text } } }
          }
        }
      }
    }`,
    { owner: REPO_OWNER, name: REPO_NAME, expression: `${REPO_BRANCH}:${EVENTS_DIR}` }
  )
  return (result.repository.object?.entries ?? [])
    .filter((entry) => entry.name.endsWith('.md') && entry.object?.text != null)
    .map((entry) => parseEventFile(entry.name.slice(0, -3), entry.object!.text!, entry.oid))
}

// Like Decap: the slug comes from the name, with -1, -2... if it's taken
export const getFreeSlug = async (name: string): Promise<string> => {
  const base = slugify(name) || 'event'
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`
    if (!(await getEventFile(candidate))) return candidate
  }
}

// Same format as the ids the CMS gives sessions (preSave in public/cms/index.html)
export const randomSessionId = () =>
  Array.from(crypto.randomBytes(8), (b) => (b % 36).toString(36)).join('')

const serialize = (data: Record<string, unknown>, body: string) => {
  const ordered: Record<string, unknown> = {}
  FIELD_ORDER.forEach((key) => {
    if (data[key] !== undefined) ordered[key] = data[key]
  })
  Object.entries(data).forEach(([key, value]) => {
    if (!(key in ordered) && value !== undefined) ordered[key] = value
  })
  const frontmatter = jsYaml.dump(ordered, { lineWidth: -1, noRefs: true })
  return `---\n${frontmatter}---\n${body.trim() ? `\n${body.trim()}\n` : ''}`
}

// Creates the file, or updates it when `sha` is given
export const saveEventFile = async (
  slug: string,
  data: Record<string, unknown>,
  body: string,
  message: string,
  sha?: string
): Promise<void> => {
  if (useLocalFiles) return fs.writeFile(pathOf(slug), serialize(data, body))
  const octokit = await getRepoOctokit()
  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      ...repo,
      path: pathOf(slug),
      branch: REPO_BRANCH,
      message,
      content: Buffer.from(serialize(data, body), 'utf8').toString('base64'),
      ...(sha && { sha }),
    })
  } catch (err) {
    if ((err as { status?: number })?.status === 409) {
      throw new AgentError(409, 'The event was changed by someone else at the same time, try again')
    }
    throw err
  }
}

export const deleteEventFile = async (file: EventFile, message: string): Promise<void> => {
  if (useLocalFiles) return fs.unlink(pathOf(file.slug))
  const octokit = await getRepoOctokit()
  await octokit.rest.repos.deleteFile({
    ...repo,
    path: pathOf(file.slug),
    branch: REPO_BRANCH,
    message,
    sha: file.sha,
  })
}
