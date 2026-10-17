// Uploaded files: event images and post images. The only way to add, read or
// delete them. In production they're in the public `media` Blob Storage
// container, which only the server writes; in development in public/media.
// Files never change (a different image gets a different name), so they are
// cached forever. Sign-up uploads are participants' answers and stay in
// Postgres (signupFiles.ts).
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { ContainerClient } from '@azure/storage-blob'
import { AgentError } from './agentApi'

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const CACHE_CONTROL = 'public, max-age=31536000, immutable'
const CONNECTION_STRING = process.env.MEDIA_STORAGE_CONNECTION_STRING
const LOCAL_DIR = path.join(process.cwd(), 'public', 'media')
const NAME = /^(events|originals\/events|posts)\/[A-Za-z0-9-]+\.[a-z]+$/

let container: ContainerClient | null = null
const getContainer = () => {
  if (!CONNECTION_STRING) return null
  container ??= new ContainerClient(CONNECTION_STRING, 'media')
  return container
}

// e.g. https://<account>.blob.core.windows.net/media, or /media in development
export const mediaBaseUrl = () =>
  (process.env.MEDIA_BASE_URL || getContainer()?.url || '/media').replace(/\/+$/, '')

const urlOf = (name: string) => `${mediaBaseUrl()}/${name}`

const nameOf = (url: string) => {
  const base = mediaBaseUrl()
  if (!base || !url.startsWith(`${base}/`)) return null
  const name = url.slice(base.length + 1)
  return NAME.test(name) ? name : null
}

export const isMediaUrl = (url: string) => nameOf(url) !== null

const put = async (name: string, data: Buffer, contentType: string) => {
  const blobs = getContainer()
  if (!blobs) {
    const file = path.join(LOCAL_DIR, name)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, data)
    return
  }
  await blobs.getBlockBlobClient(name).uploadData(data, {
    blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: CACHE_CONTROL },
  })
}

const exists = async (name: string) => {
  const blobs = getContainer()
  if (!blobs) return fs.access(path.join(LOCAL_DIR, name)).then(() => true, () => false)
  return blobs.getBlockBlobClient(name).exists()
}

const read = async (name: string): Promise<Buffer | null> => {
  const blobs = getContainer()
  if (!blobs) return fs.readFile(path.join(LOCAL_DIR, name)).catch(() => null)
  try {
    return await blobs.getBlockBlobClient(name).downloadToBuffer()
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) return null
    throw err
  }
}

const remove = async (name: string) => {
  const blobs = getContainer()
  if (!blobs) return fs.rm(path.join(LOCAL_DIR, name), { force: true })
  await blobs.getBlockBlobClient(name).deleteIfExists()
}

// A media URL's file, or null if there is none
export const readMedia = async (url: string): Promise<Buffer | null> => {
  const name = nameOf(url)
  return name ? read(name) : null
}

// The original without metadata (GPS location, camera, author, time), for making
// better versions later. sharp can't drop metadata without re-encoding, so it's
// re-encoded in the same format at high quality, keeping the colour profile.
const stripMetadata = async (input: Buffer) => {
  const { format } = await sharp(input).metadata()
  const image = sharp(input).rotate().keepIccProfile()
  if (format === 'jpeg') return { data: await image.jpeg({ quality: 95 }).toBuffer(), ext: 'jpg', type: 'image/jpeg' }
  if (format === 'webp') return { data: await image.webp({ lossless: true }).toBuffer(), ext: 'webp', type: 'image/webp' }
  return { data: await image.png().toBuffer(), ext: 'png', type: 'image/png' }
}

// An event image: stored as WebP for the site (like copyPublicAndCompressImages.js)
// and as the original without metadata. Named by the hash of the uploaded bytes,
// so the same image is stored once. Never deleted, since old revisions refer to
// them. Returns the WebP's URL.
export const uploadEventImage = async (input: Buffer): Promise<string> => {
  if (input.length > MAX_UPLOAD_BYTES) throw new AgentError(400, 'The image is larger than 15 MB')
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  const name = `events/${hash}.webp`
  if (await exists(name)) return urlOf(name)
  let webp: Buffer
  let original: Awaited<ReturnType<typeof stripMetadata>>
  try {
    webp = await sharp(input).rotate().webp({ quality: 80 }).toBuffer()
    original = await stripMetadata(input)
  } catch {
    throw new AgentError(400, 'The file is not an image')
  }
  // The WebP last: once it exists, both do
  await put(`originals/events/${hash}.${original.ext}`, original.data, original.type)
  await put(name, webp, 'image/webp')
  return urlOf(name)
}

export const postImageUrl = (id: string) => urlOf(`posts/${id}.jpg`)

// An uploaded post image (a JPEG), with a random id: post images are deleted, so
// a re-upload of the same image must not get the same name. Returns the id.
// `id` is only given when moving existing images.
export const uploadPostImage = async (jpeg: Buffer, id: string = crypto.randomUUID()) => {
  await put(`posts/${id}.jpg`, jpeg, 'image/jpeg')
  return id
}

export const deletePostImages = async (ids: string[]) => {
  await Promise.all(ids.map((id) => remove(`posts/${id}.jpg`)))
}

const publicDir = () => path.join(process.cwd(), 'public')

const SITE_IMAGE = /^\/[A-Za-z0-9._\-/ ]+\.(png|jpe?g|webp|gif)$/i

// Images under public/images, e.g. of other pages
const listSiteImages = async (): Promise<string[]> => {
  const walk = async (folder: string): Promise<string[]> => {
    const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => [])
    const nested = await Promise.all(
      entries.map((entry) =>
        entry.isDirectory() ? walk(path.join(folder, entry.name)) : [path.join(folder, entry.name)]
      )
    )
    return nested.flat()
  }
  return (await walk(path.join(publicDir(), 'images')))
    .map((file) => `/${path.relative(publicDir(), file).split(path.sep).join('/')}`)
    .filter((p) => SITE_IMAGE.test(p) && !p.includes('..'))
    .sort()
}

// Uploaded event images, newest first, then the images under public/images
export const listImages = async (): Promise<string[]> => {
  const blobs = getContainer()
  let events: { name: string; time: number }[] = []
  if (blobs) {
    for await (const blob of blobs.listBlobsFlat({ prefix: 'events/' })) {
      events.push({ name: blob.name, time: blob.properties.createdOn?.getTime() ?? 0 })
    }
  } else {
    const files = await fs.readdir(path.join(LOCAL_DIR, 'events')).catch(() => [])
    events = await Promise.all(
      files.map(async (file) => ({
        name: `events/${file}`,
        time: (await fs.stat(path.join(LOCAL_DIR, 'events', file))).mtimeMs,
      }))
    )
  }
  const uploaded = events
    .filter((e) => NAME.test(e.name))
    .sort((a, b) => b.time - a.time)
    .map((e) => urlOf(e.name))
  return [...uploaded, ...(await listSiteImages())]
}
