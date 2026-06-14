'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { Task, TaskBoard as TaskBoardType, TaskState } from '../../types/types'
import { TASK_STATES, TASK_STATE_LABELS } from '../../types/types'
import TaskColumn from './TaskColumn'
import TaskForm from './TaskForm'
import { useTelegram } from './TelegramProvider'

export default function TaskBoard() {
  const { user, chatId, ready } = useTelegram()
  const [board, setBoard] = useState<TaskBoardType | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<TaskState>('todo')

  const fetchBoard = useCallback(async () => {
    if (!chatId) return
    try {
      const res = await fetch(`/api/tasks/boards/${encodeURIComponent(chatId)}`)
      if (!res.ok) throw new Error('Failed to load board')
      const data = await res.json()
      setBoard(data.board)
      setTasks(data.tasks)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [chatId])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  const createTask = async (formData: Record<string, unknown>) => {
    const res = await fetch(`/api/tasks/boards/${encodeURIComponent(chatId!)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        createdByTgId: user ? String(user.id) : undefined,
        createdByTgName: user ? (user.username || user.firstName) : undefined,
      }),
    })
    if (!res.ok) throw new Error('Failed to create task')
    setShowForm(false)
    await fetchBoard()
  }

  const updateTask = async (taskId: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update task')
    await fetchBoard()
  }

  const deleteTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete task')
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  const tasksByState = (state: TaskState) => tasks.filter((t) => t.state === state)

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

  if (!chatId) {
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
        <button onClick={fetchBoard} className="tg-primary-btn">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">{board?.name ?? 'Task Board'}</h1>
          <p className="text-xs tg-hint mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="tg-primary-btn text-sm !py-2 !px-4"
        >
          + Add Task
        </button>
      </div>

      {showForm && (
        <div className="mb-4 tg-section-bg rounded-xl p-4 border tg-separator">
          <h2 className="text-base font-semibold mb-3">New Task</h2>
          <TaskForm onSubmit={createTask} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Mobile: tabs */}
      <div className="md:hidden">
        <div className="flex border-b tg-separator mb-4 overflow-x-auto">
          {TASK_STATES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className="px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors"
              style={
                activeTab === s
                  ? { borderColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-text-color)' }
                  : { borderColor: 'transparent', color: 'var(--tg-theme-hint-color)' }
              }
            >
              {TASK_STATE_LABELS[s]} ({tasksByState(s).length})
            </button>
          ))}
        </div>
        <TaskColumn
          state={activeTab}
          tasks={tasksByState(activeTab)}
          onUpdate={updateTask}
          onDelete={deleteTask}
        />
      </div>

      {/* Desktop: columns */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {TASK_STATES.map((s) => (
          <TaskColumn
            key={s}
            state={s}
            tasks={tasksByState(s)}
            onUpdate={updateTask}
            onDelete={deleteTask}
          />
        ))}
      </div>
    </div>
  )
}
