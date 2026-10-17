// Post images: uploads (mediaStore.ts) and site images (public/ or event images
// in mediaStore), as JPEG for Instagram
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { AgentError } from '../agentApi'
import { isMediaUrl, MAX_UPLOAD_BYTES, postImageUrl, readMedia, uploadPostImage } from '../mediaStore'
import { getMedia, isSafeSitePath, saveMedia } from '../postStore'
import type { PostImage } from './types'

export { MAX_UPLOAD_BYTES }
// Instagram's largest feed image width
const MAX_SIDE = 2160

export type LoadedImage = { data: Buffer; contentType: string; filename: string }

const toJpeg = (input: Buffer) =>
  sharp(input)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true })

export const saveUploadedImage = async (input: Buffer) => {
  if (input.length > MAX_UPLOAD_BYTES) throw new AgentError(400, 'The image is larger than 15 MB')
  const { data, info } = await toJpeg(input).catch(() => {
    throw new AgentError(400, 'The file is not an image')
  })
  // Uploaded first, so a row always has its file
  const id = await uploadPostImage(data)
  return saveMedia(id, info.width, info.height)
}

// In production public/ only has .webp versions of PNG and JPEG images
// (see copyPublicAndCompressImages.js), like the rewrite in next.config.ts
const publicDir = () => path.join(process.cwd(), 'public')

const readSiteFile = async (sitePath: string): Promise<Buffer> => {
  if (!isSafeSitePath(sitePath)) throw new AgentError(400, `"${sitePath}" is not a site image`)
  if (isMediaUrl(sitePath)) {
    const data = await readMedia(sitePath)
    if (!data) throw new AgentError(404, `Image "${sitePath}" was not found`)
    return data
  }
  const full = path.join(publicDir(), sitePath)
  if (!full.startsWith(publicDir() + path.sep)) throw new AgentError(400, 'Invalid image path')
  const candidates = [full, full.replace(/\.(png|jpe?g)$/i, '.webp')]
  for (const candidate of candidates) {
    const data = await fs.readFile(candidate).catch(() => null)
    if (data) return data
  }
  throw new AgentError(404, `Site image "${sitePath}" was not found`)
}

const cache = new Map<string, Buffer>()

// A site image as JPEG, cached since site images only change with a deployment
// and uploaded event images never change
export const siteImageAsJpeg = async (sitePath: string): Promise<Buffer> => {
  const cached = cache.get(sitePath)
  if (cached) return cached
  const { data } = await toJpeg(await readSiteFile(sitePath))
  if (cache.size > 50) cache.clear()
  cache.set(sitePath, data)
  return data
}

export const siteImageSize = async (sitePath: string) => {
  const meta = await sharp(await siteImageAsJpeg(sitePath)).metadata()
  return { width: meta.width ?? 0, height: meta.height ?? 0 }
}

export const loadImage = async (image: PostImage, index: number): Promise<LoadedImage> => {
  if ('mediaId' in image) {
    const media = await getMedia(image.mediaId)
    const data = media && (media.data ?? (await readMedia(postImageUrl(image.mediaId))))
    if (!media || !data) throw new AgentError(404, `Uploaded image ${image.mediaId} was not found`)
    return { data, contentType: media.content_type, filename: `image${index + 1}.jpg` }
  }
  return {
    data: await siteImageAsJpeg(image.sitePath),
    contentType: 'image/jpeg',
    filename: `image${index + 1}.jpg`,
  }
}

// A public JPEG URL of the image, e.g. for Instagram, which fetches images itself
export const publicImageUrl = (image: PostImage, baseUrl: string) => {
  const base = baseUrl.replace(/\/+$/, '')
  if ('sitePath' in image) return `${base}/api/posts/site-image?path=${encodeURIComponent(image.sitePath)}`
  const url = postImageUrl(image.mediaId)
  return url.startsWith('/') ? `${base}${url}` : url
}

// Instagram feed images must be between 4:5 (portrait) and 1.91:1 (landscape)
export const instagramRatioProblem = (width: number, height: number) => {
  if (!width || !height) return null
  const ratio = width / height
  if (ratio < 0.8 - 0.005) return 'taller than 4:5'
  if (ratio > 1.91 + 0.005) return 'wider than 1.91:1'
  return null
}
