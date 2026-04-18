import { Poll } from '../types/types'
import { useLivePolls } from '../utils/live'
import BetCreateForm from './BetCreateForm'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type ButtonField = 'isVisible' | 'isVotable'

const patchPoll = async (
  id: string,
  body: {
    isVisible?: boolean
    isVotable?: boolean
    correctOption?: string | null
  }
): Promise<Response> =>
  fetch(`/api/polls/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })

const deletePollReq = async (id: string): Promise<Response> =>
  fetch(`/api/polls/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })

const BetManagement = () => {
  const polls = useLivePolls()

  const [host, setHost] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') setHost(window.location.host)
  }, [])

  const setAsCorrectOption = async (poll: Poll, option: string) => {
    await patchPoll(poll.id, { correctOption: option })
  }

  const changeState = async (field: ButtonField, poll: Poll, newState: boolean) => {
    await patchPoll(poll.id, { [field]: newState })
  }

  const deletePoll = async (poll: Poll) => {
    if (!confirm(`Are you sure you want to delete the poll "${poll.question}"?`)) return
    await deletePollReq(poll.id)
  }

  const buttonFields: ButtonField[] = ['isVisible', 'isVotable']

  return (
    <div>
      <div className="mb-8 text-lg">
        <p>
          Bet results can be seen at{' '}
          <Link href="/bet" className="text-red">
            {host}/bet
          </Link>
        </p>

        <p>
          Bet scoreboard can be seen at{' '}
          <Link href="/betboard" className="text-red">
            {host}/betboard
          </Link>
        </p>
      </div>
      <div className="flex gap-8 flex-wrap">
        {polls
          .slice()
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
          <BetCreateForm />
        </div>
      </div>
    </div>
  )
}
export default BetManagement
