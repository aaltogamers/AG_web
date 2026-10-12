// Images uploaded with sign-ups (e.g. team logos), stored in Postgres as WebP.
// Uploads are sent with the sign-up itself, so there are no files without a sign-up.
import type { PoolClient } from 'pg'
import sharp from 'sharp'
import pool from './db_pg'
import type { SignupInput } from '../types/types'
import type { AnswerMap } from './signupAnswers'

// New images by field id, as data URLs
export type FileMap = Record<string, string>

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_SIDE = 512
const IMAGE_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff']
// Stands in for a new image's id until it has been saved
const PENDING = 'pending-upload'

export class UploadError extends Error {}

const toWebp = async (dataUrl: string): Promise<Buffer> => {
  const input = Buffer.from(dataUrl.replace(/^data:[^,]*,/, ''), 'base64')
  if (input.length > MAX_IMAGE_BYTES) throw new UploadError('The image is larger than 5 MB')
  try {
    const image = sharp(input, { limitInputPixels: 50_000_000 })
    const { format } = await image.metadata()
    if (!format || !IMAGE_FORMATS.includes(format))
      throw new UploadError('Use a JPG, PNG or WebP image')
    return await image
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer()
  } catch (err) {
    if (err instanceof UploadError) throw err
    throw new UploadError('The file is not an image')
  }
}

const imageKeys = (inputs: SignupInput[]) =>
  inputs.filter((i) => i.type === 'image').map((i) => String(i.id))

// Converts new uploads, and makes image answers either a new upload, the image the
// sign-up already has, or nothing. Run before validating the answers.
export const prepareImages = async (
  inputs: SignupInput[],
  answers: AnswerMap,
  files: unknown,
  previous: AnswerMap
): Promise<{ answers: AnswerMap; uploads: Map<string, Buffer> }> => {
  const out = { ...answers }
  const uploads = new Map<string, Buffer>()
  const fileMap = (files && typeof files === 'object' ? files : {}) as Record<string, unknown>
  for (const key of imageKeys(inputs)) {
    const upload = fileMap[key]
    if (typeof upload === 'string' && upload) {
      uploads.set(key, await toWebp(upload))
      out[key] = PENDING
    } else if (!out[key] || out[key] !== previous[key]) {
      delete out[key]
    }
  }
  return { answers: out, uploads }
}

// Saves the new images of a sign-up and deletes the ones they replace. Returns the
// answers with the new images' ids.
export const saveImages = async (
  client: PoolClient,
  signupId: string,
  inputs: SignupInput[],
  answers: AnswerMap,
  uploads: Map<string, Buffer>,
  previous: AnswerMap
): Promise<AnswerMap> => {
  const out = { ...answers }
  for (const [key, data] of uploads) {
    const res = await client.query<{ id: string }>(
      'INSERT INTO signup_files (signup_id, data, content_type) VALUES ($1, $2, $3) RETURNING id',
      [signupId, data, 'image/webp']
    )
    out[key] = res.rows[0].id
  }
  const stale = imageKeys(inputs)
    .map((key) => previous[key])
    .filter((id): id is string => typeof id === 'string' && !Object.values(out).includes(id))
  if (stale.length) {
    await client.query('DELETE FROM signup_files WHERE signup_id = $1 AND id::text = ANY($2)', [
      signupId,
      stale,
    ])
  }
  return out
}

export const getSignupFile = async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const result = await pool.query<{ data: Buffer; content_type: string }>(
    'SELECT data, content_type FROM signup_files WHERE id = $1',
    [id]
  )
  return result.rows[0] ?? null
}
