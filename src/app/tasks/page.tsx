'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function TasksLandingPage() {
  const router = useRouter()
  const [chatId, setChatId] = useState('')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg?.initDataUnsafe?.start_param) {
      router.replace(`/tasks/${encodeURIComponent(tg.initDataUnsafe.start_param)}`)
      return
    }
    setChecked(true)
  }, [router])

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = chatId.trim()
    if (trimmed) router.push(`/tasks/${encodeURIComponent(trimmed)}`)
  }

  if (!checked) return null

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className="px-8 md:px-24 lg:px-48 py-20">
        <header className="text-center flex flex-col items-center text-2xl">
          <h1 className="border-red border-b-8 px-8 pb-8">Task Boards</h1>
        </header>

        <div className="max-w-md mx-auto mt-12">
          <p className="text-lightgray mb-6 text-center">
            Enter a chat ID to open its task board.
          </p>
          <form onSubmit={go} className="flex gap-3">
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Chat ID"
              className="flex-1 px-4 py-3 rounded bg-darkgray border border-lightgray/30 text-white focus:border-red focus:outline-none"
            />
            <button type="submit" disabled={!chatId.trim()} className="mainbutton !py-3 disabled:opacity-50">
              Open
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
