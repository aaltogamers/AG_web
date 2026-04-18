import type { NextApiRequest, NextApiResponse } from 'next'
import pool, { ensureMigrated } from '../../../utils/db_pg'
import { subscribe, type BusTopic } from '../../../utils/bus'

export const config = {
  api: {
    // SSE responses are streamed; disable Next's default response buffering.
    bodyParser: false,
    responseLimit: false,
  },
}

const ALLOWED: readonly BusTopic[] = ['mapbans', 'polls', 'votes'] as const

const isAllowed = (t: string): t is BusTopic =>
  (ALLOWED as readonly string[]).includes(t)

type Snapshot = unknown

const getSnapshot = async (topic: BusTopic): Promise<Snapshot> => {
  switch (topic) {
    case 'mapbans': {
      const [bansRes, infoRes] = await Promise.all([
        pool.query(
          'SELECT id, map, type, team, idx FROM mapbans ORDER BY idx ASC'
        ),
        pool.query('SELECT team1, team2, game FROM mapban_info WHERE id = 1'),
      ])
      return {
        mapBans: bansRes.rows.map((r) => ({
          id: String(r.id),
          map: r.map,
          type: r.type,
          team: r.team,
          index: r.idx,
        })),
        mapBanInfo: infoRes.rows[0] ?? { team1: '', team2: '', game: 'CS 2' },
      }
    }
    case 'polls': {
      const res = await pool.query(
        `SELECT id, question, options, is_visible, is_votable, correct_option,
                points_for_win, additional_message,
                extract(epoch from created_at) * 1000 AS creation_ts
         FROM polls ORDER BY created_at ASC`
      )
      return res.rows.map((r) => ({
        id: String(r.id),
        question: r.question,
        options: r.options,
        isVisible: r.is_visible,
        isVotable: r.is_votable,
        correctOption: r.correct_option ?? undefined,
        pointsForWin: r.points_for_win ?? undefined,
        additionalMessage: r.additional_message ?? undefined,
        creationTimeStamp: Number(r.creation_ts),
      }))
    }
    case 'votes': {
      const res = await pool.query(
        `SELECT id, poll_id, picked_option, user_name, points
         FROM votes ORDER BY created_at ASC`
      )
      return res.rows.map((r) => ({
        id: String(r.id),
        poll: String(r.poll_id),
        pickedOption: r.picked_option,
        user: r.user_name,
        points: r.points ?? undefined,
      }))
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawTopic = req.query.topic
  const topic = Array.isArray(rawTopic) ? rawTopic[0] : rawTopic
  if (!topic || !isAllowed(topic)) {
    return res.status(400).json({ error: 'Invalid topic' })
  }

  try {
    await ensureMigrated()
  } catch (err) {
    console.error('[stream] migration failed:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  // Flush headers so the client knows the stream is live.
  if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === 'function') {
    ;(res as unknown as { flushHeaders: () => void }).flushHeaders()
  }

  let closed = false

  const send = async () => {
    if (closed) return
    try {
      const snapshot = await getSnapshot(topic)
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`)
    } catch (err) {
      console.error(`[stream:${topic}] snapshot failed:`, err)
    }
  }

  await send()

  const unsubscribe = subscribe(topic, () => {
    void send()
  })

  const heartbeat = setInterval(() => {
    if (closed) return
    res.write(`: ping\n\n`)
  }, 20_000)

  const cleanup = () => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    unsubscribe()
    try {
      res.end()
    } catch {
      // ignore
    }
  }

  req.on('close', cleanup)
  req.on('aborted', cleanup)
  res.on('close', cleanup)
}
