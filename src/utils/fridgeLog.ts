import pool from './db_pg'

export async function logFridgeEvent(event: string): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO fridge_inventory_logs (event) VALUES ($1)',
      [event]
    )
  } catch (err) {
    console.error('[fridgeLog] failed to log event:', err)
  }
}
