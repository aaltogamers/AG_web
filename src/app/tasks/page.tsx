'use client'

import { useState } from 'react'
import { useTelegram } from '../../components/tasks/TelegramProvider'
import TaskBoard from '../../components/tasks/TaskBoard'
import BoardPicker from '../../components/tasks/BoardPicker'

export default function TasksPage() {
  const { chatId } = useTelegram()
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)

  if (chatId) {
    return <TaskBoard />
  }

  if (selectedChatId) {
    return (
      <TaskBoard
        chatIdOverride={selectedChatId}
        onBack={() => setSelectedChatId(null)}
      />
    )
  }

  return <BoardPicker onSelectBoard={setSelectedChatId} />
}
