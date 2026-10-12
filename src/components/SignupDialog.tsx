import { FormEvent, useEffect, useMemo, useState } from 'react'
import { FaCheck, FaCircleNotch, FaCopy, FaLock } from 'react-icons/fa'
import Select from 'react-select'
import { DataValue, SignupInput, SignupPool, SignupRow } from '../types/types'
import { formatSessionTime, getSignupStatus, SignupTarget } from '../utils/eventUtils'
import {
  AnswerMap,
  clearStoredSignup,
  createSignup,
  deleteSignup,
  FileMap,
  getStoredSignup,
  readSignupDraft,
  setStoredSignup,
  storeSignupDraft,
  signupEditLink,
  SignupSummary,
  updateSignup,
} from '../utils/signupApi'
import { groupMin, sortedInputs, validateAnswers } from '../utils/signupAnswers'
import { getPlacement, poolFill, resolvePoolId } from '../utils/signupPools'
import CapacityBar from './CapacityBar'
import ConfirmedMessage, { ConfirmedInfo } from './ConfirmedMessage'
import Dialog from './Dialog'
import { SignupField } from './SignupFields'

// More groups than this are picked from a dropdown instead of a list
const MAX_POOL_OPTIONS = 4
const POOL_FIELD = 'signup-pool'
// Above the mobile nav bar, since the dialog covers the whole screen on phones
const Z_CLASS = 'z-[110]'

// Instead of saving, e.g. for trying out a form in the admin panel
export type SignupPreviewActions = {
  save: (answers: AnswerMap, poolId: number) => void
  remove: () => void
}

type Props = {
  target: SignupTarget
  summary: SignupSummary
  participants: SignupRow[]
  ownSignupId: string | null
  // Shown once the own sign-up has a place
  confirmed?: ConfirmedInfo
  onClose: () => void
  // Reloads the participants and counts after a sign-up is saved or removed
  onChanged?: () => Promise<void>
  preview?: SignupPreviewActions
}

// Groups start with their minimum number of items, so they can be filled in right away
const initialAnswers = (inputs: SignupInput[], saved?: AnswerMap): AnswerMap => {
  const answers: AnswerMap = { ...(saved ?? {}) }
  inputs.forEach((input) => {
    const key = String(input.id)
    if (input.type !== 'group') return
    const items = Array.isArray(answers[key]) ? [...(answers[key] as object[])] : []
    while (items.length < groupMin(input)) items.push({})
    answers[key] = items as DataValue
  })
  return answers
}

const SignupDialog = ({
  target,
  summary,
  participants,
  ownSignupId,
  confirmed,
  onClose,
  onChanged,
  preview,
}: Props) => {
  const { key, session, event } = target
  const { pools, counts } = summary
  const inputs = useMemo(() => sortedInputs(summary.inputs), [summary.inputs])
  const own = participants.find((p) => p.id === ownSignupId)
  // Only admins get to open the dialog before the sign-up opens
  const [isEarly] = useState(() => !preview && getSignupStatus(summary) === 'notOpen')
  const hasAlreadySignedUp = !!own && (!!preview || !!getStoredSignup(key))

  // Suggest the first public pool with room, since private ones need a password
  const defaultPool =
    (own && pools.find((p) => p.id === resolvePoolId(pools, own.pool_id))) ??
    pools.find((p) => !p.private && !poolFill(p, counts[p.id] ?? 0).isFull) ??
    pools.find((p) => !p.private) ??
    pools[0]

  const [initial] = useState(() => initialAnswers(inputs, own?.answers))
  // Unsent answers from an earlier visit, unless they were for another sign-up
  const [draft] = useState(() => {
    if (preview) return null
    const stored = readSignupDraft(key)
    return stored && stored.signupId === (own?.id ?? null) ? stored : null
  })
  const [values, setValues] = useState<AnswerMap>(() =>
    draft ? initialAnswers(inputs, draft.answers) : initial
  )
  const [poolId, setPoolId] = useState(() =>
    draft && pools.some((p) => p.id === draft.poolId) ? draft.poolId : defaultPool.id
  )
  const [isDraftRestored, setIsDraftRestored] = useState(!!draft)
  const [poolPassword, setPoolPassword] = useState('')
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [result, setResult] = useState<'saved' | 'removed' | null>(null)
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)
  const [isLinkCopied, setIsLinkCopied] = useState(false)

  const validation = useMemo(() => validateAnswers(inputs, values), [inputs, values])
  // Errors are shown once the participant has tried to send the form
  const shownErrors = hasTriedSubmit ? validation.errors : {}
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial) || poolId !== defaultPool.id

  const selectedPool = pools.find((p) => p.id === poolId) ?? pools[0]
  // The password is only asked when joining a private pool, not when already in it
  const needsPassword = (pool: SignupPool) =>
    !preview && !!pool.private && pool.id !== (own && resolvePoolId(pools, own.pool_id))

  // Keeps the unsent answers in the browser, so closing the dialog or the page loses nothing
  useEffect(() => {
    if (preview || result) return
    storeSignupDraft(key, isDirty ? { answers: values, poolId, signupId: own?.id ?? null } : null)
  }, [preview, result, key, isDirty, values, poolId, own?.id])

  const startOver = () => {
    if (!window.confirm('Clear your unsent answers?')) return
    setValues(initial)
    setPoolId(defaultPool.id)
    setIsDraftRestored(false)
  }

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

  const scrollToFirstError = () =>
    // After the errors have been rendered
    setTimeout(() => {
      const first = document.querySelector('[data-signup-error]')
      ;(first?.closest('[data-field-path]') ?? first)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setHasTriedSubmit(true)
    if (Object.keys(validation.errors).length) {
      setError('Check the fields marked in red.')
      scrollToFirstError()
      return
    }
    run(async () => {
      if (preview) {
        preview.save(validation.answers, selectedPool.id)
        setResult('saved')
        return
      }
      // New images are sent separately; kept ones by their id
      const answers: AnswerMap = {}
      const files: FileMap = {}
      Object.entries(validation.answers).forEach(([fieldKey, value]) => {
        if (typeof value === 'string' && value.startsWith('data:')) files[fieldKey] = value
        else answers[fieldKey] = value
      })
      const password = needsPassword(selectedPool) ? poolPassword : undefined
      const stored = getStoredSignup(key)
      if (hasAlreadySignedUp && stored) {
        await updateSignup(stored.id, answers, files, selectedPool.id, stored.token, password)
      } else {
        const res = await createSignup(key, answers, files, selectedPool.id, password)
        setStoredSignup(key, res.id, res.submission_token)
      }
      storeSignupDraft(key, null)
      await onChanged?.()
      setResult('saved')
    })
  }

  const removeSignup = () =>
    run(async () => {
      if (preview) {
        preview.remove()
        setResult('removed')
        return
      }
      const stored = getStoredSignup(key)
      if (!stored) return
      await deleteSignup(stored.id, stored.token)
      clearStoredSignup(key)
      storeSignupDraft(key, null)
      await onChanged?.()
      setResult('removed')
    })

  const copyEditLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setIsLinkCopied(true)
    } catch {
      window.prompt('Copy this link:', link)
    }
  }

  const subtitle = (
    <div className="text-lg text-lightgray -mt-2">
      {event.name}
      {session && ` · ${session.name ? `${session.name} · ` : ''}${formatSessionTime(session)}`}
      {preview && (
        <div className="mt-2 text-base text-white border border-red/70 px-3 py-1 w-fit">
          Preview: nothing is saved
        </div>
      )}
      {isEarly && (
        <div className="mt-2 text-base text-white border border-red/70 px-3 py-1 w-fit">
          The sign-up isn&apos;t open yet. You can sign up because you&apos;re an admin.
        </div>
      )}
    </div>
  )

  const footerClass =
    'sticky bottom-0 -mx-6 -mb-6 mt-2 px-6 py-4 bg-darkgray border-t border-gray-600 flex flex-wrap items-center gap-x-6 gap-y-3'

  if (result) {
    const placement =
      result === 'saved' && ownSignupId && getPlacement(participants, pools, ownSignupId)
    const editLink = !preview && result === 'saved' ? signupEditLink(event.slug, key) : null
    return (
      <Dialog
        onClose={onClose}
        title="Sign up"
        maxWidthClass="max-w-4xl"
        zClass={Z_CLASS}
        fullScreenOnMobile
        className="keep-dark"
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
              {confirmed && <ConfirmedMessage info={confirmed} className="w-full mt-4" />}
            </>
          )}
          {editLink && (
            <div className="w-full mt-4 text-left text-base text-lightgray flex flex-col gap-2">
              <span>
                You can edit your sign-up later in this browser. To edit it on another device, save
                this link. Anyone with the link can edit your sign-up.
              </span>
              <button
                type="button"
                className="borderbutton !text-base !py-1 !px-4 self-start flex items-center gap-2"
                onClick={() => copyEditLink(editLink)}
              >
                <FaCopy size={12} />
                {isLinkCopied ? 'Link copied!' : 'Copy edit link'}
              </button>
            </div>
          )}
        </div>
        <div className={footerClass}>
          <button type="button" className="mainbutton !text-lg !py-2 !px-6" onClick={onClose}>
            {preview ? 'See results' : 'Done'}
          </button>
        </div>
      </Dialog>
    )
  }

  const poolBar = (pool: SignupPool) => {
    const { taken, reserve, isFull } = poolFill(pool, counts[pool.id] ?? 0)
    const isOwnPool = !!own && resolvePoolId(pools, own.pool_id) === pool.id
    return (
      <CapacityBar
        label={isFull && !isOwnPool ? 'Full · you’ll be on the reserve list' : undefined}
        taken={taken}
        size={pool.size}
        reserve={reserve}
        showUnit
      />
    )
  }

  const poolOptions = pools.map((pool) => ({
    value: pool.id,
    label: `${pool.name}${pool.private ? ' (private)' : ''}`,
  }))

  return (
    <Dialog
      onClose={onClose}
      title={hasAlreadySignedUp ? 'Edit sign-up' : 'Sign up'}
      busy={isBusy}
      maxWidthClass="max-w-4xl"
      zClass={Z_CLASS}
      fullScreenOnMobile
      className="keep-dark"
    >
      {subtitle}
      {isDraftRestored && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-gray-600 px-3 py-2 text-base text-lightgray">
          <span>Your unsent answers were restored.</span>
          <button type="button" className="underline hover:text-red" onClick={startOver}>
            Start over
          </button>
        </div>
      )}
      <form onSubmit={onSubmit} className="flex flex-col text-lg" noValidate>
        {pools.length > MAX_POOL_OPTIONS && (
          <div className="flex flex-col gap-2 mb-6">
            <label htmlFor={POOL_FIELD}>
              Sign up as<span className="text-red">*</span>
            </label>
            <Select
              inputId={POOL_FIELD}
              value={poolOptions.find((o) => o.value === selectedPool.id)}
              onChange={(option) => option && setPoolId(option.value)}
              options={poolOptions}
              isSearchable={false}
              className="text-black"
              theme={(theme) => ({
                ...theme,
                colors: { ...theme.colors, primary25: 'lightgray', primary: 'red' },
              })}
            />
            {poolBar(selectedPool)}
          </div>
        )}
        {pools.length > 1 && pools.length <= MAX_POOL_OPTIONS && (
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
                      name={POOL_FIELD}
                      checked={isSelected}
                      onChange={() => setPoolId(pool.id)}
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
          <div className="mb-6 flex flex-col">
            <label htmlFor="signup-pool-password">
              {pools.length > 1 ? `Password for ${selectedPool.name}` : 'Sign-up password'}
              <span className="text-red">*</span>
            </label>
            <span className="text-base text-lightgray mb-2">
              This private group needs a password to sign up in
            </span>
            <input
              id="signup-pool-password"
              value={poolPassword}
              onChange={(e) => setPoolPassword(e.target.value)}
              className="p-2 rounded-md w-full bg-white text-black"
              required
            />
          </div>
        )}
        {inputs.map((input) => (
          <SignupField
            key={input.id}
            input={input}
            value={values[input.id]}
            onChange={(value) => setValues((old) => ({ ...old, [input.id]: value }))}
            errors={shownErrors}
            path={String(input.id)}
          />
        ))}
        <div className="text-lightgray text-sm">
          {inputs.some((input) => input.public || input.fields?.some((f) => f.public)) &&
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
