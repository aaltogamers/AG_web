import crypto from 'crypto'

export type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

export type TelegramInitData = {
  user?: TelegramUser
  chat_instance?: string
  chat_type?: string
  start_param?: string
  auth_date: number
  hash: string
}

export const validateTelegramInitData = (
  initDataRaw: string,
  botToken: string
): TelegramInitData | null => {
  const params = new URLSearchParams(initDataRaw)
  const hash = params.get('hash')
  if (!hash) return null

  const entries: string[] = []
  params.forEach((value, key) => {
    if (key !== 'hash') entries.push(`${key}=${value}`)
  })
  entries.sort()
  const dataCheckString = entries.join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (computedHash !== hash) return null

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null

  const userRaw = params.get('user')
  const user = userRaw ? (JSON.parse(userRaw) as TelegramUser) : undefined

  return {
    user,
    chat_instance: params.get('chat_instance') ?? undefined,
    chat_type: params.get('chat_type') ?? undefined,
    start_param: params.get('start_param') ?? undefined,
    auth_date: authDate,
    hash,
  }
}

export const getTelegramDisplayName = (user: TelegramUser): string => {
  if (user.username) return user.username
  const parts = [user.first_name, user.last_name].filter(Boolean)
  return parts.join(' ') || String(user.id)
}
