import Head from 'next/head'
import { useEffect } from 'react'
import type { ScoreBoardEntry } from '../types/types'
import { useLiveVotesWithPoints } from '../utils/live'
import makeBackgroundInvisible from '../utils/makeBackgroundInvisible'
import Scoreboard from '../components/Scoreboard'

const BetBoard = () => {
  const votes = useLiveVotesWithPoints()

  useEffect(() => {
    makeBackgroundInvisible()
  }, [])

  const userPoints = new Map<string, number>()

  votes.forEach(({ user, points }) => {
    if (points === undefined || points === null) return
    userPoints.set(user, (userPoints.get(user) ?? 0) + points)
  })

  const entries: ScoreBoardEntry[] = []

  userPoints.forEach((points, user) => {
    entries.push({ name: user, score: points })
  })

  return (
    <>
      <Head>
        <title>Twitch Stream Betting Scoreboard- Aalto Gamers</title>
      </Head>
      <main className="text-white bg-transparentBlack w-[500px] h-[100vh]">
        <Scoreboard entries={entries} placeholderText="Less than 3 entries" />
      </main>
    </>
  )
}

export default BetBoard
