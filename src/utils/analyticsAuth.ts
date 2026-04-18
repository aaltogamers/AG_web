import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'agAnalyticsAdminPassword'

const readStored = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const writeStored = (value: string | null) => {
  if (typeof window === 'undefined') return
  try {
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEY, value)
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // ignore
  }
}

export const useAdminPassword = () => {
  const [password, setPasswordState] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setPasswordState(readStored())
    setHydrated(true)
  }, [])

  const setPassword = useCallback((value: string | null) => {
    writeStored(value)
    setPasswordState(value)
  }, [])

  const promptForPassword = useCallback(() => {
    if (typeof window === 'undefined') return null
    const input = window.prompt('Enter admin password for analytics:')
    if (input) {
      writeStored(input)
      setPasswordState(input)
      return input
    }
    return null
  }, [])

  return { password, setPassword, promptForPassword, hydrated }
}

export const fetchWithAdmin = async (
  url: string,
  password: string | null,
  onUnauthorized: () => void
): Promise<Response> => {
  if (!password) {
    onUnauthorized()
    throw new Error('Missing admin password')
  }
  const res = await fetch(url, {
    headers: { 'x-admin-password': password },
  })
  if (res.status === 401) {
    onUnauthorized()
    throw new Error('Unauthorized')
  }
  return res
}
