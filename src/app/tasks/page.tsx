'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTelegram } from '../../components/tasks/TelegramProvider'
import TaskBoard from '../../components/tasks/TaskBoard'
import BoardPicker from '../../components/tasks/BoardPicker'

export default function TasksPage() {
  const { chatId, chatTitle } = useTelegram()
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [boardExists, setBoardExists] = useState<boolean | null>(null)

  const checkBoard = useCallback(async () => {
    if (!chatId) return
    try {
      const nameParam = chatTitle ? `&name=${encodeURIComponent(chatTitle)}` : ''
      const res = await fetch(
        `/api/tasks/boards/${encodeURIComponent(chatId)}?noCreate=true${nameParam}`
      )
      if (!res.ok) return
      const data = await res.json()
      setBoardExists(data.board !== null)
    } catch {
      setBoardExists(false)
    }
  }, [chatId, chatTitle])

  useEffect(() => {
    checkBoard()
  }, [checkBoard])

  if (chatId && boardExists === true) {
    return <TaskBoard />
  }

  if (chatId && boardExists === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full spinner"
          style={{ borderColor: 'var(--tg-theme-button-color)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (selectedChatId) {
    return (
      <TaskBoard
        chatIdOverride={selectedChatId}
        onBack={() => setSelectedChatId(null)}
      />
    )
  }

  const newGroup = chatId && !boardExists
    ? { chatId, title: chatTitle || 'this group' }
    : undefined

  return <BoardPicker onSelectBoard={setSelectedChatId} newGroup={newGroup} />
}
