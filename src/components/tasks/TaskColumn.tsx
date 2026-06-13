'use client'

import React from 'react'
import type { Task, TaskState } from '../../types/types'
import { TASK_STATE_LABELS } from '../../types/types'
import TaskCard from './TaskCard'

type Props = {
  state: TaskState
  tasks: Task[]
  onUpdate: (taskId: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

const STATE_COLORS: Record<TaskState, string> = {
  todo: 'border-lightgray/50',
  in_progress: 'border-yellow-500/50',
  done: 'border-green-500/50',
}

export default function TaskColumn({ state, tasks, onUpdate, onDelete }: Props) {
  return (
    <div className={`border-t-2 ${STATE_COLORS[state]} pt-3`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-white">
          {TASK_STATE_LABELS[state]}
        </h3>
        <span className="text-xs text-lightgray bg-black/50 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-lightgray/50 text-center py-4">No tasks</p>
        )}
      </div>
    </div>
  )
}
