'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { TaskNotificationSettings } from '../../types/types'
import { useTelegram } from './TelegramProvider'

type Props = {
  onBack: () => void
}

const NOTIFICATION_DEFAULTS: Omit<TaskNotificationSettings, 'tgUserId'> = {
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

export default function Settings({ onBack }: Props) {
  const { user } = useTelegram()

  const [notifSettings, setNotifSettings] = useState(NOTIFICATION_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [savingNotif, setSavingNotif] = useState(false)

  const fetchNotifSettings = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`/api/tasks/board/notification-settings?tgUserId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        const s = data.settings as TaskNotificationSettings
        setNotifSettings({
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
    fetchNotifSettings()
  }, [fetchNotifSettings])

  const saveNotif = async (updated: typeof notifSettings) => {
    if (!user) return
    setSavingNotif(true)
    try {
      await fetch('/api/tasks/board/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgUserId: String(user.id), ...updated }),
      })
    } catch {
      /* ignore */
    } finally {
      setSavingNotif(false)
    }
  }

  const updateNotif = <K extends keyof typeof notifSettings>(
    key: K,
    value: (typeof notifSettings)[K]
  ) => {
    const updated = { ...notifSettings, [key]: value }
    setNotifSettings(updated)
    saveNotif(updated)
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

  const checkboxes: { key: keyof typeof notifSettings; label: string }[] = [
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
        <h1 className="text-lg font-semibold tg-text">Settings</h1>
      </div>

      <div className="flex flex-col gap-5">
        <div className="tg-section-bg rounded-xl p-4 border tg-separator">
          <h3 className="text-sm font-semibold mb-3 tg-text">Notification Timing</h3>
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm tg-text">Days before deadline</span>
              <input
                type="number"
                min={0}
                max={30}
                value={notifSettings.deadlineDays}
                onChange={(e) =>
                  updateNotif('deadlineDays', Math.max(0, Number(e.target.value) || 0))
                }
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
                value={notifSettings.startDateDays}
                onChange={(e) =>
                  updateNotif('startDateDays', Math.max(0, Number(e.target.value) || 0))
                }
                className="tg-input w-16 text-center !py-1"
              />
            </label>
          </div>
        </div>

        <div className="tg-section-bg rounded-xl p-4 border tg-separator">
          <h3 className="text-sm font-semibold mb-3 tg-text">Notify me when</h3>
          <div className="flex flex-col gap-2">
            {checkboxes.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings[key] as boolean}
                  onChange={(e) => updateNotif(key, e.target.checked as never)}
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
              <span className="text-sm tg-text">
                Skip Notifications for &quot;In Progress&quot; tasks
              </span>
            </div>
            <input
              type="checkbox"
              checked={notifSettings.skipInProgress}
              onChange={(e) => updateNotif('skipInProgress', e.target.checked)}
              className="w-5 h-5 accent-[var(--tg-theme-button-color)]"
            />
          </label>
        </div>
      </div>

      {savingNotif && <p className="text-xs tg-hint text-center mt-3">Saving...</p>}
    </div>
  )
}
