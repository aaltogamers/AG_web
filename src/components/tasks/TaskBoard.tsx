'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Task, TaskState } from '../../types/types'
import TaskCard from './TaskCard'
import TaskForm from './TaskForm'
import Settings from './Settings'
import { useTelegram } from './TelegramProvider'

type AssignFilter = 'all' | 'mine' | 'mine_unassigned'

const ASSIGN_FILTER_LABELS: Record<AssignFilter, string> = {
  all: 'All',
  mine: 'Mine',
  mine_unassigned: 'Mine + Unassigned',
}

export default function TaskBoard() {
  const { user, ready, isTelegram } = useTelegram()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [hiddenStates, setHiddenStates] = useState<Set<TaskState>>(new Set(['someday']))
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all')
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

  const toggleState = (state: TaskState) => {
    setHiddenStates((prev) => {
      const next = new Set(prev)
      if (next.has(state)) next.delete(state)
      else next.add(state)
      return next
    })
  }

  const applyFilters = (list: Task[]) => {
    let filtered = list.filter((t) => !hiddenStates.has(t.state))
    if (assignFilter === 'mine' && currentUserId) {
      filtered = filtered.filter((t) => t.assignees.some((a) => a.tgUserId === currentUserId))
    } else if (assignFilter === 'mine_unassigned' && currentUserId) {
      filtered = filtered.filter(
        (t) => t.assignees.length === 0 || t.assignees.some((a) => a.tgUserId === currentUserId)
      )
    }
    return filtered
  }

  const activeTasks = sortActiveTasks(applyFilters(tasks.filter((t) => t.state !== 'done')))
  const doneTasks = hiddenStates.has('done')
    ? []
    : sortDoneTasks(applyFilters(tasks.filter((t) => t.state === 'done')))

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
          <div className="flex items-center gap-2">
            <p className="text-xs md:text-sm tg-hint">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{ backgroundColor: showFilters || hiddenStates.size > 0 || assignFilter !== 'all' ? 'var(--tg-theme-button-color, #F32929)' : 'var(--tg-theme-secondary-bg-color, rgba(0,0,0,0.05))' }}
              title="Filters"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={showFilters || hiddenStates.size > 0 || assignFilter !== 'all' ? 'var(--tg-theme-button-text-color, #fff)' : 'var(--tg-theme-hint-color)'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
          </div>
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

      {showFilters && !formOpen && (
        <div
          className="mb-4 rounded-xl p-3 border flex flex-col gap-3"
          style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color, rgba(0,0,0,0.03))',
            borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.1))',
          }}
        >
          <div>
            <span className="text-xs tg-hint block mb-1.5">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {(['someday', 'todo', 'in_progress', 'done'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => toggleState(s)}
                  className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{
                    backgroundColor: hiddenStates.has(s)
                      ? 'transparent'
                      : 'var(--tg-theme-button-color, #F32929)',
                    color: hiddenStates.has(s)
                      ? 'var(--tg-theme-hint-color)'
                      : 'var(--tg-theme-button-text-color, #fff)',
                    border: hiddenStates.has(s)
                      ? '1px solid var(--tg-theme-section-separator-color, rgba(0,0,0,0.15))'
                      : '1px solid transparent',
                  }}
                >
                  {{ someday: 'Someday', todo: 'To Do', in_progress: 'In Progress', done: 'Done' }[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs tg-hint block mb-1.5">Assigned</span>
            <select
              value={assignFilter}
              onChange={(e) => setAssignFilter(e.target.value as AssignFilter)}
              className="tg-input text-sm !py-1.5"
            >
              {(Object.keys(ASSIGN_FILTER_LABELS) as AssignFilter[]).map((k) => (
                <option key={k} value={k}>
                  {ASSIGN_FILTER_LABELS[k]}
                </option>
              ))}
            </select>
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
