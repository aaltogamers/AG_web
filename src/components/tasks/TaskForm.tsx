'use client'

import React, { useState } from 'react'
import type { Task, TaskState } from '../../types/types'
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

const toLocalDatetime = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function TaskForm({ task, onSubmit, onCancel }: Props) {
  const { user, isTelegram } = useTelegram()
  const [name, setName] = useState(task?.name ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [deadline, setDeadline] = useState(toLocalDatetime(task?.deadline))
  const [startTime, setStartTime] = useState(toLocalDatetime(task?.startTime))
  const [state, setState] = useState<TaskState>(task?.state ?? 'todo')
  const [assignees, setAssignees] = useState<{ tgUserId: string; tgUserName: string }[]>(
    task?.assignees ?? []
  )
  const [assigneeInput, setAssigneeInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const addAssignee = () => {
    const trimmed = assigneeInput.trim()
    if (!trimmed) return
    if (assignees.some((a) => a.tgUserName === trimmed)) return
    setAssignees([...assignees, { tgUserId: trimmed, tgUserName: trimmed }])
    setAssigneeInput('')
  }

  const addSelf = () => {
    if (!user) return
    const displayName = user.username || user.firstName
    const userId = String(user.id)
    if (assignees.some((a) => a.tgUserId === userId)) return
    setAssignees([...assignees, { tgUserId: userId, tgUserName: displayName }])
  }

  const removeAssignee = (tgUserId: string) => {
    setAssignees(assignees.filter((a) => a.tgUserId !== tgUserId))
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
        <label className="block text-sm text-lightgray mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded bg-black border border-lightgray/30 text-white focus:border-red focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-lightgray mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded bg-black border border-lightgray/30 text-white focus:border-red focus:outline-none resize-y"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-lightgray mb-1">Start Time</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 rounded bg-black border border-lightgray/30 text-white focus:border-red focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-lightgray mb-1">Deadline</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2 rounded bg-black border border-lightgray/30 text-white focus:border-red focus:outline-none"
          />
        </div>
      </div>

      {task && (
        <div>
          <label className="block text-sm text-lightgray mb-1">State</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as TaskState)}
            className="w-full px-3 py-2 rounded bg-black border border-lightgray/30 text-white focus:border-red focus:outline-none"
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
        <label className="block text-sm text-lightgray mb-1">Assignees</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={assigneeInput}
            onChange={(e) => setAssigneeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAssignee()
              }
            }}
            placeholder="Telegram username"
            className="flex-1 px-3 py-2 rounded bg-black border border-lightgray/30 text-white focus:border-red focus:outline-none"
          />
          <button
            type="button"
            onClick={addAssignee}
            className="borderbutton !text-sm !py-2 !px-4"
          >
            Add
          </button>
          {isTelegram && user && (
            <button
              type="button"
              onClick={addSelf}
              className="borderbutton !text-sm !py-2 !px-4"
            >
              + Me
            </button>
          )}
        </div>
        {assignees.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {assignees.map((a) => (
              <span
                key={a.tgUserId}
                className="inline-flex items-center gap-1 bg-black border border-lightgray/30 rounded px-2 py-1 text-sm"
              >
                {a.tgUserName}
                <button
                  type="button"
                  onClick={() => removeAssignee(a.tgUserId)}
                  className="text-lightgray hover:text-red ml-1"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end mt-2">
        <button type="button" onClick={onCancel} className="borderbutton !text-base !py-2 !px-6">
          Cancel
        </button>
        <button type="submit" disabled={submitting || !name.trim()} className="mainbutton !text-base !py-2 !px-6 disabled:opacity-50">
          {task ? 'Save' : 'Create Task'}
        </button>
      </div>
    </form>
  )
}
