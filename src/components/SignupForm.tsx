import moment from 'moment'
import { useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { FaCircleNotch } from 'react-icons/fa'
import { DataValue, SignupRow } from '../types/types'
import {
  AnswerMap,
  clearStoredSignup,
  createSignup,
  deleteSignup,
  getSignupEvent,
  getStoredSignup,
  listSignups,
  setStoredSignup,
  SignupEvent,
  updateSignup,
} from '../utils/signupApi'
import Input from './Input'
import ParticipantTable from './ParticipantTable'

type Props = {
  eventName: string
}

const SignUp = ({ eventName }: Props) => {
  const [signupEvent, setSignupEvent] = useState<SignupEvent | null>(null)
  const [hasPossibleSignUp, setHasPossibleSignUp] = useState<boolean>(true)
  const [participants, setParticipants] = useState<SignupRow[]>([])
  const [ownSignupId, setOwnSignupId] = useState<string | null>(null)
  const [hasAlreadySignedUp, setHasAlreadySignedUp] = useState(false)
  const { register, handleSubmit, setValue, reset, control } = useForm()
  const [isNewUpdate, setIsNewUpdate] = useState(false)

  const refreshParticipants = async (event: SignupEvent) => {
    const stored = getStoredSignup(event.name)
    const { signups, ownSignupId } = await listSignups(event.name, stored?.token)
    setParticipants(signups)
    setOwnSignupId(ownSignupId)

    if (ownSignupId) {
      const own = signups.find((s) => s.id === ownSignupId)
      if (own) {
        Object.entries(own.answers).forEach(([key, value]) => {
          setValue(key, value as DataValue)
        })
        setHasAlreadySignedUp(true)
      }
    } else {
      setHasAlreadySignedUp(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const event = await getSignupEvent(eventName)
      if (cancelled) return
      if (!event) {
        setHasPossibleSignUp(false)
        return
      }
      setSignupEvent(event)
      await refreshParticipants(event)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName])

  const removeSignUp = async () => {
    if (!signupEvent) return
    const stored = getStoredSignup(signupEvent.name)
    if (!stored) return
    if (!window.confirm('Are you sure you want to remove your sign up?')) return
    await deleteSignup(stored.id, stored.token)
    clearStoredSignup(signupEvent.name)
    setHasAlreadySignedUp(false)
    reset()
    await refreshParticipants(signupEvent)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit: SubmitHandler<any> = async (data) => {
    if (!signupEvent) return
    const answers: AnswerMap = {}
    signupEvent.inputs.forEach((input) => {
      if (input.type === 'info') return
      const key = String(input.id)
      const value = data[key]
      if (value !== undefined) answers[key] = value
    })

    const stored = getStoredSignup(signupEvent.name)
    if (hasAlreadySignedUp && stored) {
      await updateSignup(stored.id, answers, stored.token)
    } else {
      const res = await createSignup(signupEvent.name, answers)
      setStoredSignup(signupEvent.name, res.id, res.submission_token)
      setHasAlreadySignedUp(true)
    }
    await refreshParticipants(signupEvent)
    setIsNewUpdate(true)
    setTimeout(() => setIsNewUpdate(false), 2000)
  }

  if (!signupEvent) {
    return hasPossibleSignUp ? (
      <FaCircleNotch className="spinner h-12" size={34} />
    ) : (
      <div className="h-12"></div>
    )
  }

  const signUpStart = moment(signupEvent.openfrom)
  const signUpStartString = signUpStart.format('DD/MM/YYYY HH:mm')
  const signUpEnd = moment(signupEvent.openuntil)
  const signUpEndString = signUpEnd.format('DD/MM/YYYY HH:mm')
  const nowMoment = moment()
  const signUpNotYetOpen = nowMoment.isBefore(signUpStart)
  const signUpClosed = nowMoment.isAfter(signUpEnd)
  const signUpNotOpen = signUpNotYetOpen || signUpClosed

  const inputs = [...signupEvent.inputs].sort((a, b) => a.number - b.number)

  return (
    <div id="signup" className="flex flex-col gap-4">
      <h2>Sign up</h2>
      <h3>{signupEvent.name}</h3>
      <h5 className="mb-2">Open until {signUpEndString}</h5>
      {signUpNotOpen ? (
        <h5>{signUpClosed ? 'Sign-up has closed.' : `Sign-up opens on ${signUpStartString}.`}</h5>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="flex-col md:grid md:grid-cols-input text-xl">
            {inputs.map((input) => {
              const fieldKey = String(input.id)
              switch (input.type) {
                case 'text':
                  return (
                    <Input
                      register={register}
                      name={fieldKey}
                      displayName={input.title}
                      placeHolder={input.description}
                      type="text"
                      key={fieldKey}
                      required={input.required}
                      isPublic={input.public}
                      control={control}
                    />
                  )
                case 'select':
                  return (
                    <Input
                      register={register}
                      name={fieldKey}
                      displayName={input.title}
                      options={input.options}
                      key={fieldKey}
                      required={input.required}
                      isPublic={input.public}
                      isMulti={input.multi}
                      control={control}
                    />
                  )
                case 'info':
                  return (
                    <div className="col-span-2 mt-2 mb-8 md:my-4" key={fieldKey}>
                      <b>{input.title}</b>
                      <p>{input.description}</p>
                    </div>
                  )
                default:
                  return null
              }
            })}
            <div className="col-span-2 text-lightgray mb-4 text-sm">
              Never input any sensitive data on this form
            </div>
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
