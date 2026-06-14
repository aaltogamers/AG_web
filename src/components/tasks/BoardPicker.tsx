'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { BoardSummary } from '../../types/types'
import { useTelegram } from './TelegramProvider'

type Props = {
  onSelectBoard: (chatId: string) => void
}

export default function BoardPicker({ onSelectBoard }: Props) {
  const { user, ready } = useTelegram()
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hidingId, setHidingId] = useState<string | null>(null)

  const fetchBoards = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`/api/tasks/user-boards?tgUserId=${user.id}`)
      if (!res.ok) throw new Error('Failed to load boards')
      const data = await res.json()
      if (data.boards.length === 1) {
        onSelectBoard(data.boards[0].chatId)
        return
      }
      setBoards(data.boards)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [user, onSelectBoard])

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  const hideBoard = async (board: BoardSummary) => {
    if (!user) return
    setHidingId(board.id)
    setBoards((prev) => prev.filter((b) => b.id !== board.id))
    try {
      await fetch('/api/tasks/hide-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgUserId: String(user.id), chatId: board.chatId }),
      })
    } catch {
      setBoards((prev) => [...prev, board])
    } finally {
      setHidingId(null)
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full spinner"
          style={{ borderColor: 'var(--tg-theme-button-color)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Telegram Only</h1>
        <p className="tg-hint max-w-sm">
          This task board is available exclusively as a Telegram Mini App.
          Open it from the Telegram bot to get started.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full spinner"
          style={{ borderColor: 'var(--tg-theme-button-color)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="tg-destructive mb-4">{error}</p>
        <button onClick={fetchBoards} className="tg-primary-btn">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Your Boards</h1>
        <p className="text-xs tg-hint mt-0.5">
          {boards.length} board{boards.length !== 1 ? 's' : ''}
        </p>
      </div>

      {boards.length === 0 ? (
        <div className="text-center py-12">
          <p className="tg-hint max-w-xs mx-auto">
            No boards to show. Open the app from a Telegram group to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {boards.map((board) => (
            <div
              key={board.id}
              className="tg-section-bg rounded-xl border tg-separator flex items-center"
            >
              <button
                onClick={() => onSelectBoard(board.chatId)}
                className="flex-1 text-left p-3 min-w-0"
              >
                <p className="font-medium truncate">{board.name}</p>
                <p className="text-xs tg-hint mt-0.5">
                  {board.taskCount} task{board.taskCount !== 1 ? 's' : ''}
                </p>
              </button>
              <button
                onClick={() => hideBoard(board)}
                disabled={hidingId === board.id}
                className="tg-destructive text-xs px-3 py-2 mr-2 shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
