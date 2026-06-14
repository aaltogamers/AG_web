'use client'

import React from 'react'
import type { Task, TaskState } from '../../types/types'
import { TASK_STATE_LABELS } from '../../types/types'
import TaskCard from './TaskCard'

type Props = {
  state: TaskState
  tasks: Task[]
  currentUserId?: string
  onUpdate: (taskId: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

const STATE_BORDER_COLORS: Record<TaskState, string> = {
  todo: 'var(--tg-theme-hint-color, #999)',
  in_progress: 'var(--tg-theme-accent-text-color, #f59e0b)',
  done: 'var(--tg-theme-link-color, #22c55e)',
}

export default function TaskColumn({ state, tasks, currentUserId, onUpdate, onDelete }: Props) {
  return (
    <div className="border-t-2 pt-3" style={{ borderTopColor: STATE_BORDER_COLORS[state] }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tg-text">
          {TASK_STATE_LABELS[state]}
        </h3>
        <span className="text-xs tg-hint tg-card-bg px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} currentUserId={currentUserId} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {tasks.length === 0 && (
          <p className="text-sm tg-hint text-center py-4 opacity-50">No tasks</p>
        )}
      </div>
    </div>
  )
}
