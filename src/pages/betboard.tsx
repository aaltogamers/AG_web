import Head from 'next/head'
import { useEffect, useState } from 'react'
import { firebaseConfig, getVotesWithPoints } from '../utils/db'
import { getFirestore } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { ScoreBoardEntry, Vote } from '../types/types'
import makeBackgroundInvisible from '../utils/makeBackgroundInvisible'
import Scoreboard from '../components/Scoreboard'

const Vote = () => {
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const auth = getAuth()
  const [votes, setVotes] = useState<Vote[]>([])

  const refreshData = async () => {
    const newVotes = await getVotesWithPoints(db)
    setVotes(newVotes)
  }

  useEffect(() => {
    makeBackgroundInvisible()
    signInWithEmailAndPassword(auth, 'guest@aaltogamers.fi', 'aaltogamerpassword').then(() => {
      refreshData()
    })
    const interval = setInterval(() => refreshData(), 5000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  const userPoints = new Map()

  votes.forEach(({ user, points }) => {
    if (userPoints.has(user)) {
      userPoints.set(user, userPoints.get(user) + points)
    } else {
      userPoints.set(user, points)
    }
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
        <Scoreboard entries={entries} placeholderText="No entries" />
      </main>
    </>
  )
}

export default Vote
