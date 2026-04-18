import type { NextApiRequest } from 'next'

export const getQueryParam = (req: NextApiRequest, name: string): string | undefined => {
  const raw = req.query[name]
  if (Array.isArray(raw)) return raw[0]
  return raw
}

export const getHeader = (req: NextApiRequest, name: string): string | undefined => {
  const raw = req.headers[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0]
  return raw
}

export const parseJsonBody = <T = unknown>(req: NextApiRequest): T | undefined => {
  if (req.body === undefined || req.body === null) return undefined
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T
    } catch {
      return undefined
    }
  }
  return req.body as T
}
