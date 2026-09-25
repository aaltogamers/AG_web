import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../../../utils/db_pg'
import { parseJsonBody } from '../../../../utils/apiUtils'
import { createTask, type CreateTaskInput } from '../../../../utils/taskStore'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = parseJsonBody<CreateTaskInput>(req)

  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }

  try {
    const task = await createTask(body)
    return res.status(201).json({ task })
  } catch (err) {
    console.error('[tasks] create failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
