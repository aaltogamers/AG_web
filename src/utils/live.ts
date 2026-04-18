import { useEffect, useMemo, useState } from 'react'
import {
  CS_ACTIVE_DUTY_MAPS,
  MapBanInfo,
  MapBanOrPick,
  Poll,
  VALORANT_ACTIVE_DUTY_MAPS,
  Vote,
} from '../types/types'

// Subscribe to a Server-Sent Events stream. Parses each `data:` frame as JSON.
const useStream = <T,>(topic: 'mapbans' | 'polls' | 'votes', initial: T): T => {
  const [value, setValue] = useState<T>(initial)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const source = new EventSource(`/api/stream/${topic}`)
    source.onmessage = (ev) => {
      try {
        setValue(JSON.parse(ev.data) as T)
      } catch (err) {
        console.error(`[live:${topic}] parse error`, err)
      }
    }
    source.onerror = (err) => {
      // EventSource auto-reconnects; just log.
      console.debug(`[live:${topic}] stream error`, err)
    }

    return () => {
      source.close()
    }
  }, [topic])

  return value
}

type MapBanSnapshot = {
  mapBans: MapBanOrPick[]
  mapBanInfo: MapBanInfo
}

export const useLiveMapBans = () => {
  const snapshot = useStream<MapBanSnapshot>('mapbans', {
    mapBans: [],
    mapBanInfo: { team1: '', team2: '', game: 'CS 2' },
  })

  const maps = useMemo(
    () =>
      snapshot.mapBanInfo?.game === 'Valorant'
        ? [...VALORANT_ACTIVE_DUTY_MAPS]
        : [...CS_ACTIVE_DUTY_MAPS],
    [snapshot.mapBanInfo?.game]
  )

  return { mapBans: snapshot.mapBans, mapBanInfo: snapshot.mapBanInfo, maps }
}

export const useLivePolls = (): Poll[] => useStream<Poll[]>('polls', [])

export const useLiveVotes = (): Vote[] => useStream<Vote[]>('votes', [])

export const useLiveVotesWithPoints = (): Vote[] => {
  const votes = useLiveVotes()
  return useMemo(() => votes.filter((v) => v.points !== undefined && v.points !== null), [votes])
}

export const useLiveVisiblePollAndVotes = () => {
  const polls = useLivePolls()
  const votes = useLiveVotes()

  const visiblePoll = useMemo(() => polls.find((p) => p.isVisible), [polls])
  const votesForPoll = useMemo(
    () => (visiblePoll ? votes.filter((v) => v.poll === visiblePoll.id) : []),
    [visiblePoll, votes]
  )

  return { visiblePoll, votesForPoll }
}
