import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../../utils/db_pg'
import { parseJsonBody } from '../../../utils/apiUtils'
import {
  deleteTask,
  getTask,
  hasTaskChanges,
  updateTask,
  type UpdateTaskInput,
} from '../../../utils/taskStore'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  const taskId = req.query.taskId as string

  if (req.method === 'GET') {
    const task = await getTask(taskId)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    return res.status(200).json({ task })
  }

  if (req.method === 'PUT') {
    const body = parseJsonBody<UpdateTaskInput>(req)
    if (!body) {
      return res.status(400).json({ error: 'Invalid body' })
    }
    if (!hasTaskChanges(body)) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    try {
      const task = await updateTask(taskId, body)
      if (!task) {
        return res.status(404).json({ error: 'Task not found' })
      }
      return res.status(200).json({ task })
    } catch (err) {
      console.error('[tasks] update failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }

  if (req.method === 'DELETE') {
    if (!(await deleteTask(taskId))) {
      return res.status(404).json({ error: 'Task not found' })
    }
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
