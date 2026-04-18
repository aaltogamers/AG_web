import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

const COOKIE_NAME = 'ag_admin'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const getSecret = (): string => {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD
  if (!secret) throw new Error('ADMIN_SESSION_SECRET or ADMIN_PASSWORD must be set')
  return secret
}

const base64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const sign = (payload: string, secret: string): string =>
  base64url(crypto.createHmac('sha256', secret).update(payload).digest())

const timingSafeEqualStr = (a: string, b: string): boolean => {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

// Token format: <expiresAtMs>.<signature>
const buildToken = (expiresAtMs: number): string => {
  const payload = String(expiresAtMs)
  const sig = sign(payload, getSecret())
  return `${payload}.${sig}`
}

const verifyToken = (token: string): boolean => {
  const idx = token.indexOf('.')
  if (idx <= 0) return false
  const payload = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expiresAtMs = Number(payload)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false
  const expected = sign(payload, getSecret())
  return timingSafeEqualStr(sig, expected)
}

export const verifyAdminPassword = (provided: string): boolean => {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  return timingSafeEqualStr(provided, expected)
}

export const setAdminSessionCookie = (res: NextApiResponse): void => {
  const expiresAtMs = Date.now() + MAX_AGE_SECONDS * 1000
  const token = buildToken(expiresAtMs)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`
  )
}

export const clearAdminSessionCookie = (res: NextApiResponse): void => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`
  )
}

const parseCookies = (header: string | undefined): Record<string, string> => {
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export const isAdminAuthorized = (req: NextApiRequest): boolean => {
  // 1) Signed cookie (browser sessions).
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[COOKIE_NAME]
  if (token && verifyToken(token)) return true

  // 2) Raw password header (for curl / scripts).
  const header = req.headers['x-admin-password']
  const provided = Array.isArray(header) ? header[0] : header
  if (provided && verifyAdminPassword(provided)) return true

  return false
}
