import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { FaCheck, FaCircleNotch, FaLock } from 'react-icons/fa'
import { DataValue, SignupPool, SignupRow } from '../types/types'
import { formatSessionTime, SignupTarget } from '../utils/eventUtils'
import {
  AnswerMap,
  clearStoredSignup,
  createSignup,
  deleteSignup,
  getStoredSignup,
  setStoredSignup,
  SignupSummary,
  updateSignup,
} from '../utils/signupApi'
import { poolFill, resolvePoolId } from '../utils/signupPools'
import CapacityBar from './CapacityBar'
import Dialog from './Dialog'
import Input from './Input'

const POOL_FIELD = 'pool'
// Lowercase, since Input slugifies field names
const POOL_PASSWORD_FIELD = 'poolpassword'
// Above the mobile nav bar, since the dialog covers the whole screen on phones
const Z_CLASS = 'z-[110]'

type Props = {
  target: SignupTarget
  summary: SignupSummary
  participants: SignupRow[]
  ownSignupId: string | null
  onClose: () => void
  // Reloads the participants and counts after a sign-up is saved or removed
  onChanged: () => Promise<void>
}

// Where a sign-up ended up: in one of the pool's places, or on its reserve list
const getPlacement = (participants: SignupRow[], pools: SignupPool[], signupId: string) => {
  const own = participants.find((p) => p.id === signupId)
  const pool = own && pools.find((p) => p.id === resolvePoolId(pools, own.pool_id))
  if (!own || !pool) return null
  const index = participants
    .filter((p) => resolvePoolId(pools, p.pool_id) === pool.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .findIndex((p) => p.id === signupId)
  return index < pool.size
    ? { pool, isReserve: false, position: index + 1 }
    : { pool, isReserve: true, position: index - pool.size + 1 }
}

const SignupDialog = ({
  target,
  summary,
  participants,
  ownSignupId,
  onClose,
  onChanged,
}: Props) => {
  const { key, session, event } = target
  const { pools, counts } = summary
  const own = participants.find((p) => p.id === ownSignupId)
  const hasAlreadySignedUp = !!own && !!getStoredSignup(key)

  // Suggest the first public pool with room, since private ones need a password
  const defaultPool =
    (own && pools.find((p) => p.id === resolvePoolId(pools, own.pool_id))) ??
    pools.find((p) => !p.private && !poolFill(p, counts[p.id] ?? 0).isFull) ??
    pools.find((p) => !p.private) ??
    pools[0]

  const { register, handleSubmit, control, watch } = useForm({
    defaultValues: { [POOL_FIELD]: String(defaultPool.id), ...(own?.answers ?? {}) } as Record<
      string,
      DataValue
    >,
  })
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [result, setResult] = useState<'saved' | 'removed' | null>(null)
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)

  const selectedPool = pools.find((p) => String(p.id) === String(watch(POOL_FIELD))) ?? pools[0]
  // The password is only asked when joining a private pool, not when already in it
  const needsPassword = (pool: SignupPool) =>
    !!pool.private && pool.id !== (own && resolvePoolId(pools, own.pool_id))

  const run = async (action: () => Promise<void>) => {
    setError(null)
    setIsBusy(true)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsBusy(false)
    }
  }

  const onSubmit: SubmitHandler<Record<string, DataValue>> = (data) =>
    run(async () => {
      const answers: AnswerMap = {}
      summary.inputs.forEach((input) => {
        if (input.type === 'info') return
        const fieldKey = String(input.id)
        const value = data[fieldKey]
        if (value !== undefined) answers[fieldKey] = value
      })
      const poolPassword = needsPassword(selectedPool)
        ? String(data[POOL_PASSWORD_FIELD] ?? '')
        : undefined

      const stored = getStoredSignup(key)
      if (hasAlreadySignedUp && stored) {
        await updateSignup(stored.id, answers, selectedPool.id, stored.token, poolPassword)
      } else {
        const res = await createSignup(key, answers, selectedPool.id, poolPassword)
        setStoredSignup(key, res.id, res.submission_token)
      }
      await onChanged()
      setResult('saved')
    })

  const removeSignup = () =>
    run(async () => {
      const stored = getStoredSignup(key)
      if (!stored) return
      await deleteSignup(stored.id, stored.token)
      clearStoredSignup(key)
      await onChanged()
      setResult('removed')
    })

  const subtitle = (
    <div className="text-lg text-lightgray -mt-2">
      {event.name}
      {session && ` · ${session.name ? `${session.name} · ` : ''}${formatSessionTime(session)}`}
    </div>
  )

  const footerClass =
    'sticky bottom-0 -mx-6 -mb-6 mt-2 px-6 py-4 bg-darkgray border-t border-gray-600 flex flex-wrap items-center gap-x-6 gap-y-3'

  if (result) {
    const placement =
      result === 'saved' && ownSignupId && getPlacement(participants, pools, ownSignupId)
    return (
      <Dialog
        onClose={onClose}
        title="Sign up"
        maxWidthClass="max-w-xl"
        zClass={Z_CLASS}
        fullScreenOnMobile
      >
        {subtitle}
        <div className="flex flex-col items-center text-center gap-3 py-8">
          <div className="w-16 h-16 rounded-full border-2 border-red flex items-center justify-center">
            <FaCheck className="text-red" size={28} />
          </div>
          {result === 'removed' ? (
            <h4>Your sign-up was removed</h4>
          ) : placement && placement.isReserve ? (
            <>
              <h4>You&apos;re on the reserve list</h4>
              <div className="text-lg text-lightgray">
                Number {placement.position} in line
                {pools.length > 1 && ` for ${placement.pool.name}`}. You&apos;ll get a place if
                someone cancels.
              </div>
            </>
          ) : (
            <>
              <h4>You&apos;re signed up!</h4>
              {placement && (
                <div className="text-lg text-lightgray">
                  Place {placement.position} of {placement.pool.size}
                  {pools.length > 1 && ` in ${placement.pool.name}`}
                </div>
              )}
            </>
          )}
        </div>
        <div className={footerClass}>
          <button type="button" className="mainbutton !text-lg !py-2 !px-6" onClick={onClose}>
            Done
          </button>
        </div>
      </Dialog>
    )
  }

  const inputs = [...summary.inputs].sort((a, b) => a.number - b.number)

  const poolBar = (pool: SignupPool) => {
    const { taken, reserve, isFull } = poolFill(pool, counts[pool.id] ?? 0)
    const isOwnPool = !!own && resolvePoolId(pools, own.pool_id) === pool.id
    return (
      <CapacityBar
        label={isFull && !isOwnPool ? 'Full · you’ll be on the reserve list' : undefined}
        taken={taken}
        size={pool.size}
        reserve={reserve}
      />
    )
  }

  return (
    <Dialog
      onClose={onClose}
      title={hasAlreadySignedUp ? 'Edit sign-up' : 'Sign up'}
      busy={isBusy}
      maxWidthClass="max-w-xl"
      zClass={Z_CLASS}
      fullScreenOnMobile
    >
      {subtitle}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col text-lg">
        {pools.length > 1 && (
          <fieldset className="flex flex-col gap-2 mb-6">
            <legend className="mb-2">
              Sign up as<span className="text-red">*</span>
            </legend>
            {pools.map((pool) => {
              const isSelected = pool.id === selectedPool.id
              return (
                <label
                  key={pool.id}
                  className={`flex flex-col gap-2 bg-black border-l-4 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected ? 'border-red' : 'border-gray-600 hover:border-lightgray'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      value={String(pool.id)}
                      {...register(POOL_FIELD)}
                      className="accent-red w-4 h-4 shrink-0"
                    />
                    <span className="flex-1">{pool.name}</span>
                    {pool.private && <FaLock className="text-lightgray" size={14} />}
                  </div>
                  {poolBar(pool)}
                </label>
              )
            })}
          </fieldset>
        )}
        {pools.length === 1 && <div className="mb-6">{poolBar(pools[0])}</div>}
        {needsPassword(selectedPool) && (
          <Input
            register={register}
            name={POOL_PASSWORD_FIELD}
            displayName={
              pools.length > 1 ? `Password for ${selectedPool.name}` : 'Sign-up password'
            }
            type="text"
            hint="This private group needs a password to sign up in"
            required
            control={control}
            stacked
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
                  stacked
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
                  stacked
                />
              )
            case 'info':
              return (
                <div className="mb-6" key={name}>
                  <b>{field.title}</b>
                  <p className="text-lightgray">{field.description}</p>
                </div>
              )
            default:
              return null
          }
        })}
        <div className="text-lightgray text-sm">
          {inputs.some((input) => input.public) &&
            'Answers marked (public) are shown to everyone. '}
          Never input any sensitive data on this form.
        </div>
        {error && <div className="text-red mt-4">{error}</div>}
        <div className={footerClass}>
          {isConfirmingRemove ? (
            <>
              <span>Remove your sign-up?</span>
              <button
                type="button"
                className="mainbutton !text-lg !py-2 !px-6"
                onClick={removeSignup}
                disabled={isBusy}
              >
                Remove
              </button>
              <button
                type="button"
                className="text-lightgray hover:text-red"
                onClick={() => setIsConfirmingRemove(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="submit"
                className="mainbutton !text-lg !py-2 !px-6 flex items-center gap-2"
                disabled={isBusy}
              >
                {isBusy && <FaCircleNotch className="spinner" />}
                {hasAlreadySignedUp ? 'Save changes' : 'Sign up'}
              </button>
              {hasAlreadySignedUp && (
                <button
                  type="button"
                  className="text-lightgray hover:text-red"
                  onClick={() => setIsConfirmingRemove(true)}
                >
                  Remove sign-up
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </Dialog>
  )
}

export default SignupDialog
