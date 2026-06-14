'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useTelegram } from '../../components/tasks/TelegramProvider'

export default function TasksLandingPage() {
  const router = useRouter()
  const { ready, isTelegram, chatId: tgChatId } = useTelegram()

  useEffect(() => {
    if (!ready) return
    if (isTelegram && tgChatId) {
      router.replace(`/tasks/${encodeURIComponent(tgChatId)}`)
    }
  }, [ready, isTelegram, tgChatId, router])

  if (!ready || (isTelegram && tgChatId)) return null

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Telegram Only</h1>
      <p className="text-lightgray max-w-sm">
        This task board is available exclusively as a Telegram Mini App.
        Open it from the Telegram bot to get started.
      </p>
    </div>
  )
}
