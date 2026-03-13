import type { NextApiRequest, NextApiResponse } from 'next'
import pool from '../../utils/db_pg'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const result = await pool.query('SELECT NOW() AS server_time, current_database() AS database')
    const row = result.rows[0]
    return res.status(200).json({
      status: 'ok',
      serverTime: row.server_time,
      database: row.database,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ status: 'error', error: message })
  }
}
