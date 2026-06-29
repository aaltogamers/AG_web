'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { TaskState } from '../../types/types'
import { TASK_STATES, TASK_STATE_LABELS } from '../../types/types'

type Props = {
  currentState: TaskState
  onChangeState: (newState: TaskState) => void
}

const STATUS_ICONS: Record<TaskState, React.ReactNode> = {
  someday: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="#9ca3af" strokeWidth="1.5" />
    </svg>
  ),
  todo: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M8 1.5 A6.5 6.5 0 0 1 14.5 8 L8 8 Z" fill="#3b82f6" fillOpacity="0.5" />
    </svg>
  ),
  in_progress: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="#d97706" strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M8 1.5 A6.5 6.5 0 0 1 8 14.5 V1.5Z" fill="#d97706" fillOpacity="0.5" />
    </svg>
  ),
  done: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#22c55e" fillOpacity="0.5" />
    </svg>
  ),
}

export default function StatusDropdown({ currentState, onChangeState }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        className="flex items-center gap-1.5 py-1 px-2 rounded-lg transition-colors hover:opacity-80"
        style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, rgba(0,0,0,0.05))' }}
      >
        {STATUS_ICONS[currentState]}
        <span className="text-xs md:text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
          {TASK_STATE_LABELS[currentState]}
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 rounded-xl border shadow-lg z-10 py-1 min-w-[140px]"
          style={{
            backgroundColor: 'var(--tg-theme-bg-color, #fff)',
            borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.1))',
          }}
        >
          {TASK_STATES.map((s) => (
            <button
              key={s}
              onClick={(e) => {
                e.stopPropagation()
                if (s !== currentState) onChangeState(s)
                setOpen(false)
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors"
              style={{
                color: 'var(--tg-theme-text-color)',
                backgroundColor: s === currentState ? 'var(--tg-theme-secondary-bg-color, rgba(0,0,0,0.05))' : 'transparent',
              }}
            >
              {STATUS_ICONS[s]}
              {TASK_STATE_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
