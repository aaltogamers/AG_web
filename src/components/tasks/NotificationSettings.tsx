'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { TaskNotificationSettings } from '../../types/types'
import { useTelegram } from './TelegramProvider'

type Props = {
  onBack: () => void
}

const DEFAULTS: Omit<TaskNotificationSettings, 'tgUserId'> = {
  deadlineDays: 5,
  startDateDays: 0,
  notifyCreation: true,
  notifyBeforeDeadline: true,
  notifyBeforeStart: true,
  notifyOnDeadline: true,
  notifyOnStart: true,
  notifyPastDeadline: true,
  notifyPastStart: true,
  skipInProgress: false,
}

export default function NotificationSettings({ onBack }: Props) {
  const { user } = useTelegram()
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`/api/tasks/board/notification-settings?tgUserId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        const s = data.settings as TaskNotificationSettings
        setSettings({
          deadlineDays: s.deadlineDays,
          startDateDays: s.startDateDays,
          notifyCreation: s.notifyCreation,
          notifyBeforeDeadline: s.notifyBeforeDeadline,
          notifyBeforeStart: s.notifyBeforeStart,
          notifyOnDeadline: s.notifyOnDeadline,
          notifyOnStart: s.notifyOnStart,
          notifyPastDeadline: s.notifyPastDeadline,
          notifyPastStart: s.notifyPastStart,
          skipInProgress: s.skipInProgress,
        })
      }
    } catch {
      /* use defaults */
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const save = async (updated: typeof settings) => {
    if (!user) return
    setSaving(true)
    try {
      await fetch('/api/tasks/board/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgUserId: String(user.id), ...updated }),
      })
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    save(updated)
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

  const checkboxes: { key: keyof typeof settings; label: string }[] = [
    { key: 'notifyCreation', label: 'Task assigned to me' },
    { key: 'notifyBeforeDeadline', label: 'Daily, before deadline' },
    { key: 'notifyBeforeStart', label: 'Daily, before start date' },
    { key: 'notifyOnDeadline', label: 'On deadline day' },
    { key: 'notifyOnStart', label: 'On start date' },
    { key: 'notifyPastDeadline', label: 'Past deadline' },
    { key: 'notifyPastStart', label: 'Past start date' },
  ]

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="tg-hint text-sm">
          &larr; Back
        </button>
        <h1 className="text-lg font-semibold">Notification Settings</h1>
      </div>

      <div className="flex flex-col gap-5">
        <div className="tg-section-bg rounded-xl p-4 border tg-separator">
          <h2 className="text-sm font-semibold mb-3 tg-text">Notification Timing</h2>
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm tg-text">Days before deadline</span>
              <input
                type="number"
                min={0}
                max={30}
                value={settings.deadlineDays}
                onChange={(e) => update('deadlineDays', Math.max(0, Number(e.target.value) || 0))}
                className="tg-input w-16 text-center !py-1"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm tg-text">Days before start date</span>
                <span className="text-xs tg-hint block">0 = on the day</span>
              </div>
              <input
                type="number"
                min={0}
                max={30}
                value={settings.startDateDays}
                onChange={(e) => update('startDateDays', Math.max(0, Number(e.target.value) || 0))}
                className="tg-input w-16 text-center !py-1"
              />
            </label>
          </div>
        </div>

        <div className="tg-section-bg rounded-xl p-4 border tg-separator">
          <h2 className="text-sm font-semibold mb-3 tg-text">Notify me when</h2>
          <div className="flex flex-col gap-2">
            {checkboxes.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[key] as boolean}
                  onChange={(e) => update(key, e.target.checked as never)}
                  className="w-4 h-4 accent-[var(--tg-theme-button-color)]"
                />
                <span className="text-sm tg-text">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="tg-section-bg rounded-xl p-4 border tg-separator">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <span className="text-sm font-medium tg-text">
                Skip &quot;In Progress&quot; tasks
              </span>
              <span className="text-xs tg-hint block">
                Don&apos;t notify if the task is already in progress
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.skipInProgress}
              onChange={(e) => update('skipInProgress', e.target.checked)}
              className="w-5 h-5 accent-[var(--tg-theme-button-color)]"
            />
          </label>
        </div>
      </div>

      {saving && <p className="text-xs tg-hint text-center mt-3">Saving...</p>}
    </div>
  )
}
