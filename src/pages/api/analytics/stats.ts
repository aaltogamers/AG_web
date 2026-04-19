import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'

const getQueryParam = (req: NextApiRequest, name: string): string | undefined => {
  const raw = req.query[name]
  if (Array.isArray(raw)) return raw[0]
  return raw
}

const parseDate = (value: string | undefined): Date | undefined => {
  if (!value) return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

const ALLOWED_BUCKETS = new Set(['hour', 'day', 'week', 'month'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD not configured' })
  }
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const path = getQueryParam(req, 'path')
  const from = parseDate(getQueryParam(req, 'from'))
  const to = parseDate(getQueryParam(req, 'to'))
  const bucket = getQueryParam(req, 'bucket') || 'day'

  try {
    await ensureMigrated()

    if (req.method === 'DELETE') {
      if (!path || !from || !to) {
        return res.status(400).json({ error: 'path, from, and to are required' })
      }
      if (from.getTime() >= to.getTime()) {
        return res.status(400).json({ error: '"from" must be before "to"' })
      }
      const result = await pool.query(
        `DELETE FROM page_views WHERE path = $1 AND ts >= $2 AND ts < $3`,
        [path, from.toISOString(), to.toISOString()]
      )
      const deleted = result.rowCount ?? 0
      return res.status(200).json({ deleted })
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return res.status(400).json({ error: 'Invalid bucket' })
    }

    if (!path) {
      const where: string[] = []
      const params: unknown[] = []
      if (from) {
        params.push(from.toISOString())
        where.push(`ts >= $${params.length}`)
      }
      if (to) {
        params.push(to.toISOString())
        where.push(`ts < $${params.length}`)
      }
      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
      const sql = `
        SELECT path, COUNT(*)::int AS count
        FROM page_views
        ${whereClause}
        GROUP BY path
        ORDER BY count DESC
        LIMIT 1000
      `
      const result = await pool.query(sql, params)
      return res.status(200).json({ totals: result.rows })
    }

    const where: string[] = ['path = $1']
    const params: unknown[] = [path]
    if (from) {
      params.push(from.toISOString())
      where.push(`ts >= $${params.length}`)
    }
    if (to) {
      params.push(to.toISOString())
      where.push(`ts < $${params.length}`)
    }

    const seriesSql = `
      SELECT date_trunc('${bucket}', ts) AS bucket, COUNT(*)::int AS count
      FROM page_views
      WHERE ${where.join(' AND ')}
      GROUP BY bucket
      ORDER BY bucket ASC
    `
    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM page_views
      WHERE ${where.join(' AND ')}
    `

    const [seriesRes, totalRes] = await Promise.all([
      pool.query(seriesSql, params),
      pool.query(totalSql, params),
    ])

    return res.status(200).json({
      total: totalRes.rows[0]?.total ?? 0,
      series: seriesRes.rows,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[analytics/stats] query failed:', message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
