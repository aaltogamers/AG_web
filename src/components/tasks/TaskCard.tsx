'use client'

import React, { useState } from 'react'
import type { Task, TaskState } from '../../types/types'
import TaskForm from './TaskForm'

type Props = {
  task: Task
  onUpdate: (taskId: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

const STATE_TRANSITIONS: Record<TaskState, { label: string; next: TaskState }[]> = {
  todo: [{ label: 'Start', next: 'in_progress' }],
  in_progress: [
    { label: 'Done', next: 'done' },
    { label: 'Back', next: 'todo' },
  ],
  done: [{ label: 'Reopen', next: 'todo' }],
}

const formatDate = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const isOverdue = (deadline?: string): boolean => {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

export default function TaskCard({ task, onUpdate, onDelete }: Props) {
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
      <div className="bg-darkgray rounded-lg p-4 border border-lightgray/20">
        <TaskForm
          task={task}
          onSubmit={handleEdit}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const overdue = task.state !== 'done' && isOverdue(task.deadline)

  return (
    <div className="bg-darkgray rounded-lg p-3 border border-lightgray/20 hover:border-lightgray/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-left flex-1 font-medium text-white hover:text-white"
        >
          {task.name}
        </button>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-lightgray hover:text-white text-xs px-1"
            title="Edit"
          >
            Edit
          </button>
          {confirming ? (
            <button
              onClick={() => {
                onDelete(task.id)
                setConfirming(false)
              }}
              className="text-red text-xs px-1"
            >
              Confirm?
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-lightgray hover:text-red text-xs px-1"
              title="Delete"
            >
              Del
            </button>
          )}
        </div>
      </div>

      {(task.deadline || task.startTime || task.assignees.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-lightgray">
          {task.startTime && (
            <span>Start: {formatDate(task.startTime)}</span>
          )}
          {task.deadline && (
            <span className={overdue ? 'text-red' : ''}>
              Due: {formatDate(task.deadline)}
            </span>
          )}
          {task.assignees.length > 0 && (
            <span>{task.assignees.map((a) => a.tgUserName).join(', ')}</span>
          )}
        </div>
      )}

      {expanded && task.description && (
        <p className="mt-2 text-sm text-lightgray whitespace-pre-wrap">{task.description}</p>
      )}

      <div className="mt-2 flex gap-2">
        {STATE_TRANSITIONS[task.state].map(({ label, next }) => (
          <button
            key={next}
            onClick={() => handleStateChange(next)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              next === 'done'
                ? 'border-green-500/50 text-green-400 hover:bg-green-500/20'
                : 'border-lightgray/30 text-lightgray hover:border-lightgray/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
