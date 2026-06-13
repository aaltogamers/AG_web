'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type TelegramUser = {
  id: number
  firstName: string
  lastName?: string
  username?: string
}

type TelegramContextValue = {
  ready: boolean
  isTelegram: boolean
  user: TelegramUser | null
  chatId: string | null
}

const TelegramContext = createContext<TelegramContextValue>({
  ready: false,
  isTelegram: false,
  user: null,
  chatId: null,
})

export const useTelegram = () => useContext(TelegramContext)

export default function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<TelegramContextValue>({
    ready: false,
    isTelegram: false,
    user: null,
    chatId: null,
  })

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 20

    const init = () => {
      const tg = window.Telegram?.WebApp
      if (tg?.initData) {
        tg.ready()
        tg.expand()

        const rawUser = tg.initDataUnsafe.user
        const user: TelegramUser | null = rawUser
          ? {
              id: rawUser.id,
              firstName: rawUser.first_name,
              lastName: rawUser.last_name,
              username: rawUser.username,
            }
          : null

        setValue({
          ready: true,
          isTelegram: true,
          user,
          chatId: tg.initDataUnsafe.start_param ?? null,
        })
        return true
      }
      return false
    }

    if (init()) return

    const interval = setInterval(() => {
      attempts++
      if (init() || attempts >= maxAttempts) {
        clearInterval(interval)
        if (attempts >= maxAttempts) {
          setValue((prev) => ({ ...prev, ready: true }))
        }
      }
    }, 50)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (value.isTelegram) {
      document.body.classList.add('tg-miniapp')
    }
    return () => {
      document.body.classList.remove('tg-miniapp')
    }
  }, [value.isTelegram])

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>
}
