import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { FaCopy, FaEdit, FaExternalLinkAlt } from 'react-icons/fa'
import Input from './Input'
import { AGEvent, SignupRow } from '../types/types'
import {
  eventMoment,
  getSignupTargetLabel,
  getSignupTargets,
  getSignupTargetStart,
  SignupTarget,
} from '../utils/eventUtils'
import ParticipantTable from './ParticipantTable'
import CopySignupDialog from './CopySignupDialog'
import {
  deleteSignupEvent,
  getSignupEvent,
  listSignups,
  saveSignupEvent,
  SignupEvent,
} from '../utils/signupApi'
import {
  draftToForm,
  duplicateFieldIds,
  emptyFormDraft,
  formToDraft,
  FormDraft,
  hasDuplicatePoolNames,
  SignupFieldsEditor,
  SignupFormSettings,
} from './SignupFormEditor'

type Inputs = {
  // Label of the selected time & place
  target: string
}

type Props = {
  events: AGEvent[]
}

const SignUpCreateForm = ({ events }: Props) => {
  const { register, handleSubmit, setValue, control, getValues, watch } = useForm<Inputs>()
  const router = useRouter()
  const [signupData, setSignupData] = useState<SignupEvent | null>(null)
  const [participants, setParticipants] = useState<SignupRow[]>([])
  const [draft, setDraft] = useState<FormDraft>(emptyFormDraft())
  const [message, setMessage] = useState<string | null>(null)
  const [isCopyOpen, setIsCopyOpen] = useState(false)

  // Only events with sign-ups enabled in the CMS, newest first
  const startOf = (target: SignupTarget) => {
    const start = getSignupTargetStart(target)
    return start ? eventMoment(start) : null
  }
  const targets = events
    .flatMap(getSignupTargets)
    .sort((a, b) => (startOf(b)?.valueOf() ?? 0) - (startOf(a)?.valueOf() ?? 0))
  const targetOptions = targets.map((target) => {
    const label = getSignupTargetLabel(target)
    const isDuplicate = targets.filter((t) => getSignupTargetLabel(t) === label).length > 1
    return {
      key: target.key,
      label: isDuplicate ? `${label} ${startOf(target)?.format('HH:mm') ?? ''}` : label,
    }
  })
  const keyForLabel = (label: string) => targetOptions.find((o) => o.label === label)?.key

  const selectedTarget = targets.find((t) => t.key === keyForLabel(watch('target')))
  // Presets in the time pickers are relative to this, in the browser's local time
  const selectedStart = selectedTarget ? (startOf(selectedTarget)?.clone().local() ?? null) : null

  const loadParticipants = async (signupKey: string) => {
    const { signups } = await listSignups(signupKey)
    setParticipants(signups)
  }

  const loadEvent = async (label: string) => {
    const signupKey = keyForLabel(label)
    const event = signupKey ? await getSignupEvent(signupKey) : null
    setValue('target', label)
    setDraft(event ? formToDraft(event) : emptyFormDraft())
    if (!event) {
      setSignupData(null)
      setParticipants([])
      return
    }
    setSignupData(event)
    await loadParticipants(event.key)
  }

  useEffect(() => {
    if (!router.isReady) return
    // `?event=<sign-up key or event slug>` (from the event page) preselects that event once
    const requested = typeof router.query.event === 'string' ? router.query.event : null
    const requestedTarget = requested
      ? (targets.find((t) => t.key === requested) ??
        targets.find((t) => t.event.slug === requested))
      : undefined
    const initial = targetOptions.find((o) => o.key === requestedTarget?.key) ?? targetOptions[0]
    if (initial) loadEvent(initial.label)
    if (requested) {
      const query = { ...router.query }
      delete query.event
      router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  const hasDuplicateIds = duplicateFieldIds(draft).size > 0
  const duplicatePoolNames = hasDuplicatePoolNames(draft)

  const onSubmit = async (data: Inputs) => {
    const result = draftToForm(draft)
    if ('error' in result) {
      setMessage(`Error: ${result.error}`)
      return
    }
    const signupKey = keyForLabel(data.target)
    if (!signupKey) {
      setMessage('Error: choose a time & place.')
      return
    }

    try {
      const saved = await saveSignupEvent({ key: signupKey, ...result.form })
      setSignupData(saved)
      setDraft((old) => ({ ...old, pools: saved.pools }))
      setMessage('Saved!')
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    }
  }

  const deleteEvent = async () => {
    if (!signupData) return
    const label = getValues('target')
    const count = participants.length
    if (
      !window.confirm(
        `Delete the whole sign-up for "${label}"? This removes all fields, pools and ${count} sign-up(s).`
      )
    ) {
      return
    }
    const answer = window.prompt('This cannot be undone. Type DELETE to confirm.')
    if (answer?.trim().toUpperCase() !== 'DELETE') return
    try {
      await deleteSignupEvent(signupData.key)
      setDraft(emptyFormDraft())
      setValue('target', label)
      setSignupData(null)
      setParticipants([])
      setMessage('Sign-up deleted.')
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    }
  }

  if (!targets.length) {
    return (
      <p className="text-center">
        No events have sign-ups enabled. Choose a sign-up option for an event in the CMS.
      </p>
    )
  }

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center text-xl">
        <div className="grid grid-cols-input w-2/3">
          <Input
            register={register}
            name="target"
            displayName="Event"
            options={targetOptions.map((o) => o.label)}
            onChangeDo={(value) => loadEvent(value)}
            control={control}
            required
          />
          {selectedTarget && (
            <>
              <div />
              <div className="flex flex-wrap gap-2 -mt-6 mb-8 md:mx-4 md:mt-0 text-sm">
                <a
                  href={`/events/${selectedTarget.event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-lightgray rounded-md px-3 py-1 hover:border-red"
                >
                  <FaExternalLinkAlt size={12} />
                  Event page
                </a>
                <a
                  href={`/cms/#/collections/event/entries/${selectedTarget.event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-lightgray rounded-md px-3 py-1 hover:border-red"
                >
                  <FaEdit size={12} />
                  Edit event info
                </a>
                <button
                  type="button"
                  onClick={() => setIsCopyOpen(true)}
                  className="flex items-center gap-2 border border-lightgray rounded-md px-3 py-1 hover:border-red"
                >
                  <FaCopy size={12} />
                  Copy sign-up from existing event
                </button>
              </div>
            </>
          )}
          <SignupFormSettings value={draft} onChange={setDraft} eventStart={selectedStart} />
        </div>
        <div className="flex flex-col md:flex-row w-full">
          <div className="w-full md:w-1/2">
            <SignupFieldsEditor value={draft} onChange={setDraft} />
            <div className="text-center h-4 mb-8 mt-4">{message}</div>
            <div className="flex flex-col items-center mb-16">
              {hasDuplicateIds && (
                <div className="text-red mb-2">
                  Two or more fields share the same ID. IDs must be unique.
                </div>
              )}
              <button
                type="submit"
                className="mainbutton"
                disabled={hasDuplicateIds || duplicatePoolNames}
              >
                Save changes
              </button>
              {signupData && (
                <button type="button" className="borderbutton mt-8 text-base" onClick={deleteEvent}>
                  Delete entire sign-up
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col w-full md:w-1/2">
            {signupData && (
              <ParticipantTable
                signupData={signupData}
                participants={participants}
                showPrivateData
                allowEdit
                onChange={() => loadParticipants(signupData.key)}
              />
            )}
          </div>
        </div>
      </form>
      {isCopyOpen && selectedTarget && (
        <CopySignupDialog
          targetKey={selectedTarget.key}
          targetLabel={getValues('target')}
          labels={targetOptions.map(({ key, label }) => ({ value: key, label }))}
          participantCount={signupData ? participants.length : 0}
          onClose={() => setIsCopyOpen(false)}
          onCopied={async () => {
            await loadEvent(getValues('target'))
            setMessage('Sign-up copied!')
            setTimeout(() => setMessage(null), 2000)
          }}
        />
      )}
    </div>
  )
}

export default SignUpCreateForm
