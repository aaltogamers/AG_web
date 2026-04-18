import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { isAdminAuthorized } from '../../../utils/adminSession'
import { parseJsonBody } from '../../../utils/apiUtils'
import { publish } from '../../../utils/bus'

type PatchBody = {
  isVisible?: boolean
  isVotable?: boolean
  correctOption?: string | null
  additionalMessage?: string | null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[polls/:id] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  const rawId = req.query.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (!id) return res.status(400).json({ error: 'Missing id' })

  if (req.method === 'GET') {
    const result = await pool.query(
      `SELECT id, question, options, is_visible, is_votable, correct_option,
              points_for_win, additional_message, created_at
       FROM polls WHERE id = $1`,
      [id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const r = result.rows[0]
    return res.status(200).json({
      poll: {
        id: String(r.id),
        question: r.question,
        options: r.options,
        isVisible: r.is_visible,
        isVotable: r.is_votable,
        correctOption: r.correct_option ?? undefined,
        pointsForWin: r.points_for_win ?? undefined,
        additionalMessage: r.additional_message ?? undefined,
        creationTimeStamp:
          r.created_at instanceof Date ? r.created_at.getTime() : new Date(r.created_at).getTime(),
      },
    })
  }

  if (req.method === 'PUT') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    const body = parseJsonBody<PatchBody>(req)
    if (!body) return res.status(400).json({ error: 'Invalid body' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const pollRes = await client.query(
        `SELECT id, options, is_visible, is_votable, correct_option
         FROM polls WHERE id = $1 FOR UPDATE`,
        [id]
      )
      if (pollRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Not found' })
      }
      const poll = pollRes.rows[0] as {
        options: string[]
        is_visible: boolean
        is_votable: boolean
        correct_option: string | null
      }

      const updates: string[] = []
      const params: unknown[] = []

      if (typeof body.isVisible === 'boolean') {
        // Only one poll may be visible at a time.
        if (body.isVisible) {
          await client.query(
            `UPDATE polls SET is_visible = FALSE WHERE is_visible = TRUE AND id <> $1`,
            [id]
          )
        }
        params.push(body.isVisible)
        updates.push(`is_visible = $${params.length}`)
      }

      if (typeof body.isVotable === 'boolean') {
        if (body.isVotable && poll.correct_option) {
          // Votable polls can't already have a decided correct option.
          params.push(false)
          updates.push(`is_votable = $${params.length}`)
        } else {
          if (body.isVotable) {
            await client.query(
              `UPDATE polls SET is_votable = FALSE WHERE is_votable = TRUE AND id <> $1`,
              [id]
            )
          }
          params.push(body.isVotable)
          updates.push(`is_votable = $${params.length}`)
        }
      }

      if (body.additionalMessage !== undefined) {
        params.push(body.additionalMessage)
        updates.push(`additional_message = $${params.length}`)
      }

      // Handle correctOption toggling + point recalculation inside the tx.
      if (body.correctOption !== undefined) {
        const clearing =
          body.correctOption === null ||
          body.correctOption === '' ||
          body.correctOption === poll.correct_option

        if (clearing) {
          updates.push(`correct_option = NULL`, `points_for_win = NULL`)
          await client.query(`UPDATE votes SET points = NULL WHERE poll_id = $1`, [id])
        } else {
          if (poll.is_votable) {
            await client.query('ROLLBACK')
            return res.status(400).json({
              error: 'Close betting before setting correct option',
            })
          }
          const votesRes = await client.query(
            `SELECT id, picked_option FROM votes WHERE poll_id = $1`,
            [id]
          )
          const total = votesRes.rows.length
          const winningPicks = votesRes.rows.filter(
            (v: { picked_option: string }) => v.picked_option === body.correctOption
          ).length
          const pointsForWin =
            winningPicks > 0 ? Math.round((total / winningPicks) * 100) : 0

          params.push(body.correctOption)
          updates.push(`correct_option = $${params.length}`)
          params.push(pointsForWin)
          updates.push(`points_for_win = $${params.length}`)

          await client.query(
            `UPDATE votes
             SET points = CASE WHEN picked_option = $1 THEN $2 ELSE 0 END
             WHERE poll_id = $3`,
            [body.correctOption, pointsForWin, id]
          )
        }
      }

      if (updates.length > 0) {
        params.push(id)
        await client.query(
          `UPDATE polls SET ${updates.join(', ')} WHERE id = $${params.length}`,
          params
        )
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      console.error('[polls/:id] update failed:', err)
      return res.status(500).json({ error: 'Internal error' })
    } finally {
      client.release()
    }

    publish('polls')
    publish('votes')
    return res.status(204).end()
  }

  if (req.method === 'DELETE') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })
    await pool.query('DELETE FROM polls WHERE id = $1', [id])
    publish('polls')
    publish('votes')
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
