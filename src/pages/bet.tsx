import Head from 'next/head'
import { useEffect, useState } from 'react'
import { firebaseConfig, getVisiblePoll, getVotesForPoll } from '../utils/db'
import { getFirestore } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { Poll, Vote } from '../types/types'
import makeBackgroundInvisible from '../utils/makeBackgroundInvisible'

type Count = {
  name: string
  count: number
  color: string
}

const Vote = () => {
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const auth = getAuth()
  const [visiblePoll, setVisiblePoll] = useState<Poll | undefined>(undefined)
  const [votesForPoll, setVotesForPoll] = useState<Vote[]>([])

  const getAndSetVisiblePoll = async () => {
    const newVisiblePoll = await getVisiblePoll(db)
    setVisiblePoll(newVisiblePoll)
    return newVisiblePoll
  }

  const generateCountMap = (votes: Vote[], poll: Poll) => {
    const countMap = new Map()
    poll.options.forEach((option) => countMap.set(option, 0))
    votes.forEach(({ pickedOption }) => {
      if (countMap.has(pickedOption)) {
        countMap.set(pickedOption, countMap.get(pickedOption) + 1)
      }
    })
    return countMap
  }

  const refreshGraph = async () => {
    const newVisiblePoll = await getAndSetVisiblePoll()
    if (newVisiblePoll) {
      const newVotes = await getVotesForPoll(db, newVisiblePoll.id)
      setVotesForPoll(newVotes)
    }
  }

  useEffect(() => {
    makeBackgroundInvisible()
    signInWithEmailAndPassword(auth, 'guest@aaltogamers.fi', 'aaltogamerpassword').then(() => {
      refreshGraph()
    })
    const interval = setInterval(() => refreshGraph(), 5000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  if (!visiblePoll) {
    return <></>
  }

  const countMap = generateCountMap(votesForPoll, visiblePoll)

  const colors = ['#262E70', '#F89E1B', '#F4D35E', '#70C1B3', '#1098F7', '#14281D']

  const mapArray = Array.from(countMap, ([key, value]) => ({ name: key.toString(), count: value }))

  const counts: Count[] = mapArray
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, count }, i) => ({
      name,
      count,
      color: colors[i],
    }))

  const screenWidth = 800
  const screenHeight = 500
  const topTextHeight = 75
  const bottomTextHeight = 50
  const graphHeight = screenHeight - bottomTextHeight - topTextHeight

  const barAndMarginHeight = graphHeight / counts.length

  const barHeight = barAndMarginHeight * 0.8
  const marginHeight = barAndMarginHeight * 0.2

  const totalMaybe0 = counts.reduce((acc, { count }) => acc + count, 0)

  const total = totalMaybe0 === 0 ? 1 : totalMaybe0

  return (
    <>
      <Head>
        <title>Twitch Stream Betting - Aalto Gamers</title>
      </Head>
      <main className={`text-white flex flex-col text-4xl h-[${screenHeight}px]`}>
        <div className={`h[${topTextHeight}px] flex justify-end`}>
          <p className=" bg-transparentBlack p-2 w-fit text-5xl mx-2 my-2">
            {visiblePoll.question}
          </p>
        </div>
        {counts
          .sort((a, b) => b.count - a.count)
          .map(({ count, name, color }) => {
            const percentage = (count / total) * 100
            const isCorrectOption = visiblePoll.correctOption === name
            const pollHasEnded = visiblePoll.correctOption !== undefined
            let textClass = ''
            let pointsText = ''
            if (pollHasEnded) {
              if (isCorrectOption) {
                textClass = 'text-green-500'
                pointsText = `+${visiblePoll.pointsForWin} pt`
              } else {
                textClass = 'text-red'
                pointsText = `+0 pt`
              }
            }

            return (
              <div
                className="flex items-center pl-8 justify-end "
                style={{ marginBottom: marginHeight }}
                key={name}
              >
                <div className={`mr-4 p-2 bg-transparentBlack text-center ${textClass}`}>
                  <p>{name}</p>
                  <p>{pointsText}</p>
                </div>
                <div
                  className="flex items-center pl-4"
                  style={{
                    width: Math.max((percentage / 100) * screenWidth, 75),
                    height: barHeight,
                    backgroundColor: color,
                  }}
                >
                  {percentage.toFixed(0)}%
                </div>
              </div>
            )
          })}
        <p style={{ height: bottomTextHeight }} className="flex justify-end px-4 text-3xl">
          {total} Bets.
          {visiblePoll.isVotable ? ' Betting is open! Use the chat to bet.' : ' Betting is closed.'}
        </p>
      </main>
    </>
  )
}

export default Vote
