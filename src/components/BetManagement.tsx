import { FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  updateDoc,
  deleteField,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore'
import { Poll } from '../types/types'
import { getVotesForPoll, useFirestore } from '../utils/db'
import BetCreateForm from './BetCreateForm'
import Link from 'next/link'

type Props = {
  app: FirebaseApp
}

type ButtonField = 'isVisible' | 'isVotable'

const BetManagement = ({ app }: Props) => {
  const db = getFirestore(app)
  const polls = useFirestore(app, 'polls') as Poll[]

  const setAsCorrectOption = async (poll: Poll, option: string) => {
    const pollRef = doc(db, 'polls', poll.id)
    const alreadyHasCorrectOption = poll.correctOption === option
    const votesForPoll = await getVotesForPoll(db, poll.id)
    if (alreadyHasCorrectOption) {
      const batch = writeBatch(db)
      batch.update(pollRef, { correctOption: deleteField(), pointsForWin: deleteField() })
      votesForPoll.forEach(async (vote) => {
        const voteRef = doc(db, 'votes', vote.id)
        batch.update(voteRef, { points: deleteField() })
      })
      await batch.commit()
    } else if (!poll.isVotable) {
      const winningOptionPicks = votesForPoll.filter(
        ({ pickedOption }) => pickedOption === option
      ).length
      const pointMultiplier = votesForPoll.length / winningOptionPicks
      const pointsForWin = Math.round(pointMultiplier * 100)

      const batch = writeBatch(db)
      batch.update(pollRef, { correctOption: option, pointsForWin })

      votesForPoll.forEach(async (vote) => {
        const voteRef = doc(db, 'votes', vote.id)
        if (vote.pickedOption === option) {
          batch.update(voteRef, { points: pointsForWin })
        } else {
          batch.update(voteRef, { points: 0 })
        }
      })
      await batch.commit()
    }
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
  }

  const deletePoll = async (poll: Poll) => {
    const canDelete = confirm(`Are you sure you want to delete the poll "${poll.question}"?`)
    if (canDelete) {
      await deleteDoc(doc(db, 'polls', poll.id))
    }
  }

  const buttonFields: ButtonField[] = ['isVisible', 'isVotable']

  return (
    <div>
      <div className="mb-8 text-lg">
        <p>
          Bet results can be seen at{' '}
          <Link href="/bet" className="text-red">
            {window.location.host}/bet
          </Link>
        </p>

        <p>
          Bet scoreboard can be seen at{' '}
          <Link href="/betboard" className="text-red">
            {window.location.host}/betboard
          </Link>
        </p>
      </div>
      <div className="flex gap-8 flex-wrap">
        {polls
          .sort((a, b) => a.creationTimeStamp - b.creationTimeStamp)
          .map((poll) => (
            <div className="p-4 border-2 relative" key={poll.id}>
              <h4>{poll.question}</h4>
              <div className="flex flex-col gap-2 items-start mt-4">
                {poll.options.map((option) => (
                  <div key={option}>
                    <button
                      className={`borderbutton ${
                        poll.correctOption === option && 'bg-green-600'
                      } mr-4`}
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
              {poll.additionalMessage && <p className="text-md">{poll.additionalMessage}</p>}

              <button
                className="absolute top-0 right-1 text-xl p-2"
                onClick={() => deletePoll(poll)}
              >
                ✖
              </button>
            </div>
          ))}
        <div>
          <BetCreateForm app={app} />
        </div>
      </div>
    </div>
  )
}
export default BetManagement
