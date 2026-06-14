'use client'

import React, { useState } from 'react'
import type { Task, TaskState } from '../../types/types'
import TaskForm from './TaskForm'

type Props = {
  task: Task
  currentUserId?: string
  onUpdate: (taskId: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

const STATE_TRANSITIONS: Record<TaskState, { label: string; next: TaskState }[]> = {
  todo: [{ label: 'Mark as in progress', next: 'in_progress' }],
  in_progress: [
    { label: 'Mark as done', next: 'done' },
    { label: 'Mark as todo', next: 'todo' },
  ],
  done: [{ label: 'Mark as todo', next: 'todo' }],
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

export default function TaskCard({ task, currentUserId, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)

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
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="task-card rounded-xl p-4 border tg-separator">
        <TaskForm
          task={task}
          onSubmit={handleEdit}
          onCancel={() => setEditing(false)}
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
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="tg-hint text-xs p-1"
            title="Edit"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          {confirming ? (
            <button
              onClick={() => {
                onDelete(task.id)
                setConfirming(false)
              }}
              className="tg-destructive text-xs px-1"
            >
              Confirm?
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="tg-hint text-xs p-1"
              title="Delete"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {(task.deadline || task.startTime || task.assignees.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs tg-hint">
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
      )}

      {expanded && task.description && (
        <p className="mt-2 text-sm tg-hint whitespace-pre-wrap">{task.description}</p>
      )}

      <div className="mt-2 flex gap-2 flex-wrap">
        {STATE_TRANSITIONS[task.state].map(({ label, next }) => (
          <button
            key={next}
            onClick={() => handleStateChange(next)}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={
              next === 'done'
                ? { borderColor: 'var(--tg-theme-link-color, #22c55e)', color: 'var(--tg-theme-link-color, #22c55e)' }
                : { borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.1))', color: 'var(--tg-theme-hint-color)' }
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
