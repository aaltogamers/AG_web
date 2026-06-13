'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { Task, TaskBoard as TaskBoardType, TaskState } from '../../types/types'
import { TASK_STATES, TASK_STATE_LABELS } from '../../types/types'
import TaskColumn from './TaskColumn'
import TaskForm from './TaskForm'
import { useTelegram } from './TelegramProvider'

type Props = {
  chatId: string
}

export default function TaskBoard({ chatId }: Props) {
  const { user, isTelegram } = useTelegram()
  const [board, setBoard] = useState<TaskBoardType | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<TaskState>('todo')

  const fetchBoard = useCallback(async () => {
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
    const res = await fetch(`/api/tasks/boards/${encodeURIComponent(chatId)}/tasks`, {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-red border-t-transparent rounded-full spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red mb-4">{error}</p>
        <button onClick={fetchBoard} className="mainbutton !text-base">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className={`${isTelegram ? 'px-4 py-4' : 'px-4 md:px-8 lg:px-16 py-8'}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium">{board?.name ?? 'Task Board'}</h1>
          <p className="text-sm text-lightgray mt-1">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mainbutton !text-base !py-2 !px-5"
        >
          + Add Task
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-darkgray rounded-lg p-4 border border-lightgray/20">
          <h2 className="text-lg font-medium mb-4">New Task</h2>
          <TaskForm onSubmit={createTask} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Mobile: tabs */}
      <div className="md:hidden">
        <div className="flex border-b border-lightgray/20 mb-4 overflow-x-auto">
          {TASK_STATES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === s
                  ? 'border-red text-white'
                  : 'border-transparent text-lightgray hover:text-white'
              }`}
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
