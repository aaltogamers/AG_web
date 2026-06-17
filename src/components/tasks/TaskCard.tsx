'use client'

import React, { useState } from 'react'
import type { Task, TaskState } from '../../types/types'
import TaskForm from './TaskForm'
import StatusDropdown from './StatusDropdown'

type Props = {
  task: Task
  currentUserId?: string
  onUpdate: (taskId: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
  onEditingChange?: (editing: boolean) => void
}

const formatDate = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  const day = d.getDate().toString().padStart(2, '0')
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

const isOverdue = (deadline?: string): boolean => {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

const getAssigneeDisplayName = (a: { tgUserName: string; firstName?: string; lastName?: string }) => {
  if (a.firstName) return `${a.firstName}${a.lastName ? ' ' + a.lastName : ''}`
  return a.tgUserName
}

export default function TaskCard({ task, currentUserId, onUpdate, onDelete, onEditingChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const setEditingState = (value: boolean) => {
    setEditing(value)
    onEditingChange?.(value)
  }

  const handleStateChange = async (newState: TaskState) => {
    await onUpdate(task.id, { state: newState })
  }

  const handleEdit = async (data: Record<string, unknown>) => {
    await onUpdate(task.id, {
      name: data.name,
      description: (data.description as string) || null,
      deadline: (data.deadline as string) || null,
      startTime: (data.startTime as string) || null,
      state: data.state,
      assignees: data.assignees,
    })
    setEditingState(false)
  }

  const handleDelete = async () => {
    await onDelete(task.id)
    setEditingState(false)
  }

  if (editing) {
    return (
      <div className="task-card rounded-xl p-4 border tg-separator">
        <TaskForm
          task={task}
          onSubmit={handleEdit}
          onCancel={() => setEditingState(false)}
          onDelete={handleDelete}
        />
      </div>
    )
  }

  const overdue = task.state !== 'done' && isOverdue(task.deadline)
  const isAssignedToMe = currentUserId
    ? task.assignees.some((a) => a.tgUserId === currentUserId)
    : false

  return (
    <div
      className={`task-card rounded-xl p-3 transition-colors cursor-pointer${isAssignedToMe ? ' border-2' : ' border tg-separator'}`}
      style={isAssignedToMe ? { borderColor: 'var(--tg-theme-button-color)' } : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        setExpanded(!expanded)
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-left flex-1 font-medium tg-text">
          {task.name}
        </span>
        <button
          onClick={() => setEditingState(true)}
          className="tg-hint p-1 shrink-0"
          title="Edit"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tg-hint">
        <StatusDropdown currentState={task.state} onChangeState={handleStateChange} />
        {task.description && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        )}
        {task.startTime && (
          <span>Start: {formatDate(task.startTime)}</span>
        )}
        {task.deadline && (
          <span className={overdue ? 'tg-destructive' : ''}>
            Due: {formatDate(task.deadline)}
          </span>
        )}
        {task.assignees.length > 0 && (
          <span>{task.assignees.map((a) => getAssigneeDisplayName(a)).join(', ')}</span>
        )}
      </div>

      {expanded && task.description && (
        <p className="mt-2 text-sm tg-hint whitespace-pre-wrap">{task.description}</p>
      )}
    </div>
  )
}
