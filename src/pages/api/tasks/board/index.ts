import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureMigrated } from '../../../../utils/db_pg'
import { isTaskState, listTasks } from '../../../../utils/taskStore'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch {
    return res.status(500).json({ error: 'Internal error' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stateParam = typeof req.query.state === 'string' ? req.query.state : undefined
  const states = stateParam ? stateParam.split(',').filter(isTaskState) : undefined

  return res.status(200).json({ tasks: await listTasks(states) })
}
