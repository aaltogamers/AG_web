import { FirebaseApp } from 'firebase/app'
import { getFirestore, doc, updateDoc, deleteField, deleteDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Poll } from '../types/types'
import { getPolls, getVotesForPoll } from '../utils/db'
import BetCreateForm from './BetCreateForm'

type Props = {
  app: FirebaseApp
}

type ButtonField = 'isVisible' | 'isVotable'

const BetManagement = ({ app }: Props) => {
  const db = getFirestore(app)
  const [polls, setPolls] = useState<Poll[]>([])

  const updatePolls = async () => {
    const newPolls = await getPolls(db)
    setPolls(newPolls)
  }

  const setAsCorrectOption = async (poll: Poll, option: string) => {
    const pollRef = doc(db, 'polls', poll.id)
    const alreadyHasCorrectOption = poll.correctOption === option
    const votesForPoll = await getVotesForPoll(db, poll.id)
    if (alreadyHasCorrectOption) {
      await updateDoc(pollRef, { correctOption: deleteField(), pointsForWin: deleteField() })
      votesForPoll.forEach(async (vote) => {
        const voteRef = doc(db, 'votes', vote.id)
        await updateDoc(voteRef, { points: deleteField() })
      })
    } else if (!poll.isVotable) {
      const winningOptionPicks = votesForPoll.filter(
        ({ pickedOption }) => pickedOption === option
      ).length
      const pointMultiplier = votesForPoll.length / winningOptionPicks
      const pointsForWin = Math.round(pointMultiplier * 100)
      await updateDoc(pollRef, { correctOption: option, pointsForWin })

      votesForPoll.forEach(async (vote) => {
        const voteRef = doc(db, 'votes', vote.id)
        if (vote.pickedOption === option) {
          await updateDoc(voteRef, { points: pointsForWin })
        } else {
          await updateDoc(voteRef, { points: 0 })
        }
      })
    }
    await updatePolls()
  }

  const changeState = async (field: ButtonField, poll: Poll, newState: boolean) => {
    const pollRef = doc(db, 'polls', poll.id)
    const somePollsIsAlready = polls.some((poll) => poll[field])
    const alreadyHasCorrectOption = field === 'isVotable' && poll.correctOption
    if (newState && !somePollsIsAlready && !alreadyHasCorrectOption) {
      await updateDoc(pollRef, { [field]: true })
    } else {
      await updateDoc(pollRef, { [field]: false })
    }
    await updatePolls()
  }

  const deletePoll = async (poll: Poll) => {
    const canDelete = confirm(`re you sure you want to delete the poll "${poll.question}"?`)
    if (canDelete) {
      await deleteDoc(doc(db, 'polls', poll.id))
    }
  }

  useEffect(() => {
    updatePolls()
  }, [])

  const buttonFields: ButtonField[] = ['isVisible', 'isVotable']

  return (
    <div className="flex gap-8 flex-wrap">
      {polls.map((poll) => (
        <div className="p-4 border-2 relative" key={poll.id}>
          <h4>{poll.question}</h4>
          <div className="flex flex-col gap-2 items-start mt-4">
            {poll.options.map((option) => (
              <div>
                <button
                  className={`borderbutton ${poll.correctOption === option && 'bg-green-600'} mr-4`}
                  key={option}
                  onClick={() => setAsCorrectOption(poll, option)}
                >
                  {option}
                </button>
                <span className="text-xl">
                  {poll.pointsForWin && poll.correctOption === option
                    ? `${poll.pointsForWin} points`
                    : ''}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 m-4">
            {buttonFields.map((field) => (
              <button
                className={`mainbutton ${poll[field] && 'bg-green-600'}`}
                key={field}
                onClick={() => changeState(field, poll, !poll[field])}
              >
                {field.slice(2)}
              </button>
            ))}
          </div>
          <button className="absolute top-0 right-1 text-xl p-2" onClick={() => deletePoll(poll)}>
            ✖
          </button>
        </div>
      ))}
      <div>
        <BetCreateForm app={app} />
      </div>
    </div>
  )
}
export default BetManagement
