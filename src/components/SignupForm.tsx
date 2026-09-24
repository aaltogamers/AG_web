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

const POOL_FIELD = 'pool'
// Lowercase, since Input slugifies field names
const POOL_PASSWORD_FIELD = 'poolpassword'

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
  const { register, handleSubmit, setValue, reset, control, watch } = useForm()
  const [isNewUpdate, setIsNewUpdate] = useState(false)
  const [ownPoolId, setOwnPoolId] = useState<number | null>(null)

  // The select input holds either a name or a single-item array of names
  const poolForValue = (poolValue: unknown) => {
    const poolName = Array.isArray(poolValue) ? poolValue[0] : poolValue
    return signupEvent.pools.find((p) => p.name === poolName) ?? signupEvent.pools[0]
  }
  const selectedPool = poolForValue(watch(POOL_FIELD))
  // The password is only asked when joining a private pool, not when already in it
  const needsPassword = selectedPool.private && selectedPool.id !== ownPoolId

  const refreshParticipants = async () => {
    const stored = getStoredSignup(key)
    const { signups, ownSignupId } = await listSignups(key, stored?.token)
    setParticipants(signups)
    setOwnSignupId(ownSignupId)

    const own = ownSignupId && signups.find((s) => s.id === ownSignupId)
    if (own) {
      const ownPool = signupEvent.pools.find((p) => p.id === own.pool_id)
      if (ownPool) setValue(POOL_FIELD, ownPool.name)
      setOwnPoolId(own.pool_id)
      Object.entries(own.answers).forEach(([fieldKey, value]) => {
        setValue(fieldKey, value as DataValue)
      })
      setHasAlreadySignedUp(true)
    } else {
      setHasAlreadySignedUp(false)
      setOwnPoolId(null)
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

    const poolId = poolForValue(data[POOL_FIELD]).id
    const poolPassword = needsPassword ? data[POOL_PASSWORD_FIELD] : undefined

    setError(null)
    try {
      const stored = getStoredSignup(key)
      if (hasAlreadySignedUp && stored) {
        await updateSignup(stored.id, answers, poolId, stored.token, poolPassword)
      } else {
        const res = await createSignup(key, answers, poolId, poolPassword)
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
            {signupEvent.pools.length > 1 && (
              <Input
                register={register}
                name={POOL_FIELD}
                displayName="Sign up as"
                options={signupEvent.pools.map((p) => p.name)}
                optionLabel={(name) =>
                  signupEvent.pools.find((p) => p.name === name)?.private
                    ? `${name} (private)`
                    : name
                }
                required
                isPublic
                control={control}
              />
            )}
            {needsPassword && (
              <Input
                register={register}
                name={POOL_PASSWORD_FIELD}
                displayName={
                  signupEvent.pools.length > 1
                    ? `Password for ${selectedPool.name}`
                    : 'Sign-up password'
                }
                type="text"
                hint="This private group needs a password to sign up in"
                required
                control={control}
              />
            )}
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
