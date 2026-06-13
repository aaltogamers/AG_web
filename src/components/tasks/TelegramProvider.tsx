'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type TelegramUser = {
  id: number
  firstName: string
  lastName?: string
  username?: string
}

type TelegramContextValue = {
  isTelegram: boolean
  user: TelegramUser | null
  chatId: string | null
}

const TelegramContext = createContext<TelegramContextValue>({
  isTelegram: false,
  user: null,
  chatId: null,
})

export const useTelegram = () => useContext(TelegramContext)

export default function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<TelegramContextValue>({
    isTelegram: false,
    user: null,
    chatId: null,
  })

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg?.initData) return

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
      isTelegram: true,
      user,
      chatId: tg.initDataUnsafe.start_param ?? null,
    })
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
