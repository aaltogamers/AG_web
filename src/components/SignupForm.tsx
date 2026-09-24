import { useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { FaCircleNotch } from 'react-icons/fa'
import { DataValue, SignupRow } from '../types/types'
import moment from 'moment'
import {
  formatSessionTime,
  formatSignupTime,
  getSignupStatus,
  SignupTarget,
} from '../utils/eventUtils'
import {
  AnswerMap,
  clearStoredSignup,
  createSignup,
  deleteSignup,
  getStoredSignup,
  listSignups,
  setStoredSignup,
  SignupEvent,
  updateSignup,
} from '../utils/signupApi'
import { useNow } from '../utils/useNow'
import Input from './Input'
import ParticipantTable from './ParticipantTable'

type Props = {
  target: SignupTarget
  signupEvent: SignupEvent
}

const SignUp = ({ target, signupEvent }: Props) => {
  const { key, session } = target
  const now = useNow()
  const [isLoading, setIsLoading] = useState(true)
  const [participants, setParticipants] = useState<SignupRow[]>([])
  const [ownSignupId, setOwnSignupId] = useState<string | null>(null)
  const [hasAlreadySignedUp, setHasAlreadySignedUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, setValue, reset, control } = useForm()
  const [isNewUpdate, setIsNewUpdate] = useState(false)

  const refreshParticipants = async () => {
    const stored = getStoredSignup(key)
    const { signups, ownSignupId } = await listSignups(key, stored?.token)
    setParticipants(signups)
    setOwnSignupId(ownSignupId)

    const own = ownSignupId && signups.find((s) => s.id === ownSignupId)
    if (own) {
      Object.entries(own.answers).forEach(([fieldKey, value]) => {
        setValue(fieldKey, value as DataValue)
      })
      setHasAlreadySignedUp(true)
    } else {
      setHasAlreadySignedUp(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    reset()
    setIsLoading(true)
    refreshParticipants().then(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const removeSignUp = async () => {
    const stored = getStoredSignup(key)
    if (!stored) return
    if (!window.confirm('Are you sure you want to remove your sign up?')) return
    await deleteSignup(stored.id, stored.token)
    clearStoredSignup(key)
    setHasAlreadySignedUp(false)
    reset()
    await refreshParticipants()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit: SubmitHandler<any> = async (data) => {
    const answers: AnswerMap = {}
    signupEvent.inputs.forEach((input) => {
      if (input.type === 'info') return
      const fieldKey = String(input.id)
      const value = data[fieldKey]
      if (value !== undefined) answers[fieldKey] = value
    })

    setError(null)
    try {
      const stored = getStoredSignup(key)
      if (hasAlreadySignedUp && stored) {
        await updateSignup(stored.id, answers, stored.token)
      } else {
        const res = await createSignup(key, answers)
        setStoredSignup(key, res.id, res.submission_token)
        setHasAlreadySignedUp(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    await refreshParticipants()
    setIsNewUpdate(true)
    setTimeout(() => setIsNewUpdate(false), 2000)
  }

  const heading = (
    <>
      <h2>Sign up</h2>
      {session && (
        <h3>
          {session.name ? `${session.name} · ` : ''}
          {formatSessionTime(session)}
        </h3>
      )}
    </>
  )

  if (!now || isLoading) {
    return (
      <div id="signup" className="flex flex-col gap-4">
        {heading}
        <FaCircleNotch className="spinner h-12" size={34} />
      </div>
    )
  }

  const status = getSignupStatus(signupEvent, now)
  const inputs = [...signupEvent.inputs].sort((a, b) => a.number - b.number)

  return (
    <div id="signup" className="flex flex-col gap-4">
      {heading}
      <h5 className="mb-2">Open until {formatSignupTime(moment(signupEvent.openuntil))}</h5>
      {status !== 'open' ? (
        <h5>
          {status === 'closed'
            ? 'Sign-up has closed.'
            : `Sign-up opens on ${formatSignupTime(moment(signupEvent.openfrom))}.`}
        </h5>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="flex-col md:grid md:grid-cols-input text-xl">
            {inputs.map((field) => {
              const name = String(field.id)
              switch (field.type) {
                case 'text':
                  return (
                    <Input
                      register={register}
                      name={name}
                      displayName={field.title}
                      placeHolder={field.description}
                      type="text"
                      key={name}
                      required={field.required}
                      isPublic={field.public}
                      control={control}
                    />
                  )
                case 'select':
                  return (
                    <Input
                      register={register}
                      name={name}
                      displayName={field.title}
                      options={field.options}
                      key={name}
                      required={field.required}
                      isPublic={field.public}
                      isMulti={field.multi}
                      control={control}
                    />
                  )
                case 'info':
                  return (
                    <div className="col-span-2 mt-2 mb-8 md:my-4" key={name}>
                      <b>{field.title}</b>
                      <p>{field.description}</p>
                    </div>
                  )
                default:
                  return null
              }
            })}
            <div className="col-span-2 text-lightgray mb-4 text-sm">
              Never input any sensitive data on this form
            </div>
            {error && <div className="col-span-2 text-red mb-4">{error}</div>}
            <div className="col-span-2 flex justify-center gap-8">
              <div>
                <button type="submit" className="mainbutton flex gap-2">
                  {hasAlreadySignedUp ? 'Update sign-up' : 'Sign up'}
                  <div className="relative text-md">
                    <div className={`${isNewUpdate && 'checkmark'}`} />
                  </div>
                </button>
              </div>
              {hasAlreadySignedUp && (
                <div>
                  <button type="button" className="mainbutton" onClick={removeSignUp}>
                    Remove sign-up
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      )}
      <ParticipantTable
        signupData={signupEvent}
        participants={participants}
        ownSignupId={ownSignupId}
      />
    </div>
  )
}

export default SignUp
