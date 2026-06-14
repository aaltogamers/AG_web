'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { Task, TaskState, TgUser } from '../../types/types'
import { TASK_STATES, TASK_STATE_LABELS } from '../../types/types'
import { useTelegram } from './TelegramProvider'

type TaskFormData = {
  name: string
  description: string
  deadline: string
  startTime: string
  state: TaskState
  assignees: { tgUserId: string; tgUserName: string }[]
}

type Props = {
  task?: Task
  onSubmit: (data: TaskFormData) => Promise<void>
  onCancel: () => void
}

const toLocalDate = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 10)
}

const displayName = (u: TgUser) =>
  u.username || `${u.firstName}${u.lastName ? ' ' + u.lastName : ''}`

export default function TaskForm({ task, onSubmit, onCancel }: Props) {
  const { chatId } = useTelegram()
  const [name, setName] = useState(task?.name ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [deadline, setDeadline] = useState(toLocalDate(task?.deadline))
  const [startTime, setStartTime] = useState(toLocalDate(task?.startTime))
  const [state, setState] = useState<TaskState>(task?.state ?? 'todo')
  const [assignees, setAssignees] = useState<{ tgUserId: string; tgUserName: string }[]>(
    task?.assignees ?? []
  )
  const [assigneeInput, setAssigneeInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState<TgUser[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSuggestions = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || !chatId) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/tasks/boards/${encodeURIComponent(chatId)}/users?q=${encodeURIComponent(query)}`
        )
        if (res.ok) {
          const data = await res.json()
          const filtered = data.users.filter(
            (u: TgUser) => !assignees.some((a) => a.tgUserId === u.tgUserId)
          )
          setSuggestions(filtered)
          setShowSuggestions(filtered.length > 0)
          setSelectedIndex(-1)
        }
      } catch { /* ignore */ }
    }, 250)
  }

  const selectSuggestion = (u: TgUser) => {
    if (assignees.some((a) => a.tgUserId === u.tgUserId)) return
    setAssignees([...assignees, { tgUserId: u.tgUserId, tgUserName: displayName(u) }])
    setAssigneeInput('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const addAssignee = async () => {
    const trimmed = assigneeInput.trim()
    if (!trimmed) return
    if (assignees.some((a) => a.tgUserName === trimmed || a.tgUserId === trimmed)) return

    if (/^\d+$/.test(trimmed) && chatId) {
      setResolving(true)
      try {
        const res = await fetch(
          `/api/tasks/boards/${encodeURIComponent(chatId)}/resolve-user`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgUserId: trimmed }),
          }
        )
        if (res.ok) {
          const data = await res.json()
          const u = data.user as TgUser
          setAssignees([...assignees, { tgUserId: u.tgUserId, tgUserName: displayName(u) }])
          setAssigneeInput('')
          setSuggestions([])
          setShowSuggestions(false)
          setResolving(false)
          return
        }
      } catch { /* fall through */ }
      setResolving(false)
    }

    setAssignees([...assignees, { tgUserId: trimmed, tgUserName: trimmed }])
    setAssigneeInput('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const removeAssignee = (tgUserId: string) => {
    setAssignees(assignees.filter((a) => a.tgUserId !== tgUserId))
  }

  const handleAssigneeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && selectedIndex >= 0 && suggestions[selectedIndex]) {
        selectSuggestion(suggestions[selectedIndex])
      } else {
        addAssignee()
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        deadline: deadline ? new Date(deadline).toISOString() : '',
        startTime: startTime ? new Date(startTime).toISOString() : '',
        state,
        assignees,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm tg-hint mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tg-input"
          required
        />
      </div>

      <div>
        <label className="block text-sm tg-hint mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="tg-input resize-y"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm tg-hint mb-1">Start Date</label>
          <input
            type="date"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="tg-input"
          />
        </div>
        <div>
          <label className="block text-sm tg-hint mb-1">Deadline</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="tg-input"
          />
        </div>
      </div>

      {task && (
        <div>
          <label className="block text-sm tg-hint mb-1">State</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as TaskState)}
            className="tg-input"
          >
            {TASK_STATES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm tg-hint mb-1">Assignees</label>
        <div ref={autocompleteRef} className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              value={assigneeInput}
              onChange={(e) => {
                setAssigneeInput(e.target.value)
                fetchSuggestions(e.target.value)
              }}
              onKeyDown={handleAssigneeKeyDown}
              onFocus={() => {
                if (assigneeInput.trim()) fetchSuggestions(assigneeInput)
              }}
              placeholder="Name, username, or user ID"
              className="tg-input flex-1"
            />
            <button
              type="button"
              onClick={addAssignee}
              disabled={resolving}
              className="tg-secondary-btn text-sm !py-2 !px-4 shrink-0"
            >
              {resolving ? '...' : 'Add'}
            </button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 tg-card-bg border tg-separator rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((u, i) => (
                <button
                  key={u.tgUserId}
                  type="button"
                  onClick={() => selectSuggestion(u)}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={{
                    backgroundColor: i === selectedIndex
                      ? 'var(--tg-theme-button-color)'
                      : 'transparent',
                    color: i === selectedIndex
                      ? 'var(--tg-theme-button-text-color)'
                      : 'var(--tg-theme-text-color)',
                  }}
                >
                  <span className="font-medium">
                    {u.firstName}{u.lastName ? ` ${u.lastName}` : ''}
                  </span>
                  {u.username && (
                    <span className="ml-2 tg-hint text-xs">@{u.username}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {assignees.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {assignees.map((a) => (
              <span
                key={a.tgUserId}
                className="inline-flex items-center gap-1 tg-card-bg border tg-separator rounded-lg px-2 py-1 text-sm"
              >
                {a.tgUserName}
                <button
                  type="button"
                  onClick={() => removeAssignee(a.tgUserId)}
                  className="tg-hint ml-1"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end mt-2">
        <button type="button" onClick={onCancel} className="tg-secondary-btn">
          Cancel
        </button>
        <button type="submit" disabled={submitting || !name.trim()} className="tg-primary-btn">
          {task ? 'Save' : 'Create Task'}
        </button>
      </div>
    </form>
  )
}
