// Reads and writes event markdown files in the GitHub repo, the same way
// Decap CMS does, so the AI agent MCP server can manage events. Commits to the
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
// Where the CMS puts uploaded images (media_folder in public/cms/config.yml)
export const IMAGES_DIR = 'public/images'

// Frontmatter keys in the order of the event fields in public/cms/config.yml
export const FIELD_ORDER = [
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

export type ExtraFile = { path: string; content: Buffer }

// Commits files together with the event file in one commit, e.g. an image used by the event
const commitWithFiles = async (
  slug: string,
  content: string,
  message: string,
  extraFiles: ExtraFile[],
  sha?: string
): Promise<string> => {
  const octokit = await getRepoOctokit()
  const { data: ref } = await octokit.rest.git.getRef({ ...repo, ref: `heads/${REPO_BRANCH}` })
  const { data: parent } = await octokit.rest.git.getCommit({ ...repo, commit_sha: ref.object.sha })
  // Like createOrUpdateFileContents: refuse if the event changed since it was read
  const current = await getEventFile(slug)
  if ((current?.sha ?? undefined) !== sha) {
    throw new AgentError(409, 'The event was changed by someone else at the same time, try again')
  }
  const blobs = await Promise.all(
    [{ path: pathOf(slug), content: Buffer.from(content, 'utf8') }, ...extraFiles].map(
      async (file) => {
        const { data } = await octokit.rest.git.createBlob({
          ...repo,
          content: file.content.toString('base64'),
          encoding: 'base64',
        })
        return { path: file.path, mode: '100644' as const, type: 'blob' as const, sha: data.sha }
      }
    )
  )
  const { data: tree } = await octokit.rest.git.createTree({
    ...repo,
    base_tree: parent.tree.sha,
    tree: blobs,
  })
  const { data: commit } = await octokit.rest.git.createCommit({
    ...repo,
    message,
    tree: tree.sha,
    parents: [parent.sha],
  })
  await octokit.rest.git.updateRef({ ...repo, ref: `heads/${REPO_BRANCH}`, sha: commit.sha })
  return commit.sha
}

// Creates the file, or updates it when `sha` is given. `extraFiles` (paths from
// the repo root) are committed in the same commit. Returns the commit's sha.
export const saveEventFile = async (
  slug: string,
  data: Record<string, unknown>,
  body: string,
  message: string,
  sha?: string,
  extraFiles: ExtraFile[] = []
): Promise<string | undefined> => {
  if (useLocalFiles) {
    await Promise.all(extraFiles.map((file) => fs.writeFile(file.path, file.content)))
    await fs.writeFile(pathOf(slug), serialize(data, body))
    return undefined
  }
  if (extraFiles.length) {
    return commitWithFiles(slug, serialize(data, body), message, extraFiles, sha)
  }
  const octokit = await getRepoOctokit()
  try {
    const res = await octokit.rest.repos.createOrUpdateFileContents({
      ...repo,
      path: pathOf(slug),
      branch: REPO_BRANCH,
      message,
      content: Buffer.from(serialize(data, body), 'utf8').toString('base64'),
      ...(sha && { sha }),
    })
    return res.data.commit.sha
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
