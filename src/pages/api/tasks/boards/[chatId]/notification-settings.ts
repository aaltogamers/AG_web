import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../../../utils/db_pg'
import { parseJsonBody } from '../../../../../utils/apiUtils'
import type { TaskNotificationSettings } from '../../../../../types/types'

const DEFAULTS: Omit<TaskNotificationSettings, 'chatId' | 'tgUserId'> = {
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

function rowToSettings(row: Record<string, unknown>): TaskNotificationSettings {
  return {
    chatId: row.chat_id as string,
    tgUserId: row.tg_user_id as string,
    deadlineDays: row.deadline_days as number,
    startDateDays: row.start_date_days as number,
    notifyCreation: row.notify_creation as boolean,
    notifyBeforeDeadline: row.notify_before_deadline as boolean,
    notifyBeforeStart: row.notify_before_start as boolean,
    notifyOnDeadline: row.notify_on_deadline as boolean,
    notifyOnStart: row.notify_on_start as boolean,
    notifyPastDeadline: row.notify_past_deadline as boolean,
    notifyPastStart: row.notify_past_start as boolean,
    skipInProgress: row.skip_in_progress as boolean,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  const chatId = req.query.chatId as string

  if (req.method === 'GET') {
    const tgUserId = req.query.tgUserId as string
    if (!tgUserId) return res.status(400).json({ error: 'tgUserId is required' })

    try {
      const result = await pool.query(
        'SELECT * FROM task_notification_settings WHERE chat_id = $1 AND tg_user_id = $2',
        [chatId, tgUserId]
      )
      if (result.rows.length === 0) {
        return res.status(200).json({
          settings: { chatId, tgUserId, ...DEFAULTS },
        })
      }
      return res.status(200).json({ settings: rowToSettings(result.rows[0]) })
    } catch (err) {
      console.error('[notification-settings] get failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }

  if (req.method === 'PUT') {
    const body = parseJsonBody<Partial<TaskNotificationSettings> & { tgUserId: string }>(req)
    if (!body || !body.tgUserId) return res.status(400).json({ error: 'tgUserId is required' })

    try {
      const result = await pool.query(
        `INSERT INTO task_notification_settings
           (chat_id, tg_user_id, deadline_days, start_date_days,
            notify_creation, notify_before_deadline, notify_before_start,
            notify_on_deadline, notify_on_start, notify_past_deadline, notify_past_start,
            skip_in_progress)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (chat_id, tg_user_id) DO UPDATE SET
           deadline_days = $3, start_date_days = $4,
           notify_creation = $5, notify_before_deadline = $6, notify_before_start = $7,
           notify_on_deadline = $8, notify_on_start = $9,
           notify_past_deadline = $10, notify_past_start = $11,
           skip_in_progress = $12, updated_at = now()
         RETURNING *`,
        [
          chatId,
          body.tgUserId,
          body.deadlineDays ?? DEFAULTS.deadlineDays,
          body.startDateDays ?? DEFAULTS.startDateDays,
          body.notifyCreation ?? DEFAULTS.notifyCreation,
          body.notifyBeforeDeadline ?? DEFAULTS.notifyBeforeDeadline,
          body.notifyBeforeStart ?? DEFAULTS.notifyBeforeStart,
          body.notifyOnDeadline ?? DEFAULTS.notifyOnDeadline,
          body.notifyOnStart ?? DEFAULTS.notifyOnStart,
          body.notifyPastDeadline ?? DEFAULTS.notifyPastDeadline,
          body.notifyPastStart ?? DEFAULTS.notifyPastStart,
          body.skipInProgress ?? DEFAULTS.skipInProgress,
        ]
      )
      return res.status(200).json({ settings: rowToSettings(result.rows[0]) })
    } catch (err) {
      console.error('[notification-settings] update failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
