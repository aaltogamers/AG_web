'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Task } from '../../types/types'
import TaskCard from './TaskCard'
import TaskForm from './TaskForm'
import Settings from './Settings'
import { useTelegram } from './TelegramProvider'

export default function TaskBoard() {
  const { user, ready, isTelegram } = useTelegram()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const formOpen = showForm || editingTaskId !== null

  const registeredRef = useRef(false)

  useEffect(() => {
    if (!user || registeredRef.current) return
    registeredRef.current = true
    fetch('/api/tasks/board/register-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tgUserId: String(user.id),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      }),
    }).catch(() => {})
  }, [user])

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/board')
      if (!res.ok) throw new Error('Failed to load tasks')
      const data = await res.json()
      setTasks(data.tasks)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  const createTask = async (formData: Record<string, unknown>) => {
    const res = await fetch('/api/tasks/board/tasks', {
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

  const sortActiveTasks = (list: Task[]) => {
    return [...list].sort((a, b) => {
      const dateA = a.deadline || a.startTime
      const dateB = b.deadline || b.startTime
      if (dateA && !dateB) return -1
      if (!dateA && dateB) return 1
      if (!dateA && !dateB) return 0
      return new Date(dateA!).getTime() - new Date(dateB!).getTime()
    })
  }

  const sortDoneTasks = (list: Task[]) => {
    return [...list].sort((a, b) => {
      if (a.doneAt && b.doneAt) return new Date(b.doneAt).getTime() - new Date(a.doneAt).getTime()
      if (a.doneAt && !b.doneAt) return -1
      if (!a.doneAt && b.doneAt) return 1
      return 0
    })
  }

  const currentUserId = user ? String(user.id) : undefined
  const activeTasks = sortActiveTasks(tasks.filter((t) => t.state !== 'done'))
  const doneTasks = sortDoneTasks(tasks.filter((t) => t.state === 'done'))

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

  if (showSettings) {
    return (
      <Settings
        onBack={() => setShowSettings(false)}
      />
    )
  }

  return (
    <div className="px-4 py-4">
      {!formOpen && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs md:text-sm tg-hint">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            {isTelegram && (
              <button
                onClick={() => setShowSettings(true)}
                className="tg-secondary-btn text-sm !py-2 !px-3"
                title="Notification settings"
              >
                Settings
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="tg-primary-btn text-sm !py-2 !px-4"
            >
              + Add Task
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-4 tg-section-bg rounded-xl p-4 border tg-separator">
          <TaskForm onSubmit={createTask} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {activeTasks.map((task) => (
          <TaskCard key={task.id} task={task} currentUserId={currentUserId} onUpdate={updateTask} onDelete={deleteTask} onEditingChange={(editing) => setEditingTaskId(editing ? task.id : null)} />
        ))}
        {activeTasks.length === 0 && doneTasks.length === 0 && (
          <p className="text-sm tg-hint text-center py-4 opacity-50">No tasks</p>
        )}
      </div>

      {doneTasks.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 border-t tg-separator" />
            <span className="text-xs md:text-sm tg-hint">Completed ({doneTasks.length})</span>
            <div className="flex-1 border-t tg-separator" />
          </div>
          <div className="flex flex-col gap-2">
            {doneTasks.map((task) => (
              <TaskCard key={task.id} task={task} currentUserId={currentUserId} onUpdate={updateTask} onDelete={deleteTask} onEditingChange={(editing) => setEditingTaskId(editing ? task.id : null)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
