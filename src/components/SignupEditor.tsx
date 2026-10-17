import { FormEvent, useEffect, useState } from 'react'
import {
  FaCopy,
  FaExternalLinkAlt,
  FaEye,
  FaSave,
  FaTrash,
  FaUndo,
} from 'react-icons/fa'
import { SignupRow } from '../types/types'
import {
  eventMoment,
  getSignupTargetLabel,
  getSignupTargetStart,
  SignupTarget,
} from '../utils/eventUtils'
import ParticipantTable from './ParticipantTable'
import CopySignupDialog from './CopySignupDialog'
import SignupPreview from './SignupPreview'
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
import { useToast } from './Toast'

type Props = {
  // The sign-up being edited
  target: SignupTarget
  // All sign-ups, for copying from another one
  allTargets: SignupTarget[]
  // The label of the back button; the event's name by default
  backLabel?: string
  onClose: () => void
}

type Tab = 'fields' | 'signups'

const DISCARD_CONFIRM = 'You have unsaved changes. Discard them?'

const iconLink =
  'p-2 rounded-md border border-lightgray bg-white hover:border-red hover:text-red text-black'

const startOf = (target: SignupTarget) => {
  const start = getSignupTargetStart(target)
  return start ? eventMoment(start) : null
}

// Edits the sign-up form of an event or one of its sessions, and shows who has signed up
const SignupEditor = ({ target, allTargets, backLabel, onClose }: Props) => {
  const toast = useToast()
  const [signupData, setSignupData] = useState<SignupEvent | null>(null)
  const [participants, setParticipants] = useState<SignupRow[]>([])
  const [draft, setDraft] = useState<FormDraft>(emptyFormDraft())
  const [savedDraft, setSavedDraft] = useState(() => JSON.stringify(draft))
  const [isLoaded, setIsLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>('fields')
  const [busy, setBusy] = useState(false)
  const [isCopyOpen, setIsCopyOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Newest first
  const targets = [...allTargets].sort(
    (a, b) => (startOf(b)?.valueOf() ?? 0) - (startOf(a)?.valueOf() ?? 0)
  )
  const targetOptions = targets.map((t) => {
    const label = getSignupTargetLabel(t)
    const isDuplicate = targets.filter((other) => getSignupTargetLabel(other) === label).length > 1
    return {
      key: t.key,
      label: isDuplicate ? `${label} ${startOf(t)?.format('HH:mm') ?? ''}` : label,
    }
  })
  const label = targetOptions.find((o) => o.key === target.key)?.label ?? getSignupTargetLabel(target)

  // Presets in the time pickers are relative to this, in the browser's local time
  const selectedStart = startOf(target)?.clone().local() ?? null

  const isDirty = JSON.stringify(draft) !== savedDraft

  const loadParticipants = async (signupKey: string) => {
    const { signups } = await listSignups(signupKey)
    setParticipants(signups)
  }

  const loadTarget = async () => {
    const event = await getSignupEvent(target.key)
    const loaded = event ? formToDraft(event) : emptyFormDraft()
    setDraft(loaded)
    setSavedDraft(JSON.stringify(loaded))
    setSignupData(event)
    if (event) await loadParticipants(event.key)
    else setParticipants([])
    setIsLoaded(true)
  }

  useEffect(() => {
    loadTarget()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.key])

  // Asks before the page is closed with unsaved changes
  useEffect(() => {
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const hasDuplicateIds = duplicateFieldIds(draft).size > 0
  const duplicatePoolNames = hasDuplicatePoolNames(draft)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const result = draftToForm(draft)
    if ('error' in result) {
      toast(`Error: ${result.error}`, { isError: true })
      return
    }
    setBusy(true)
    try {
      const saved = await saveSignupEvent({ key: target.key, ...result.form })
      const next = { ...draft, pools: saved.pools }
      setSignupData(saved)
      setDraft(next)
      setSavedDraft(JSON.stringify(next))
      toast('Saved.')
    } catch (err) {
      toast(`Error: ${err instanceof Error ? err.message : err}`, { isError: true })
    } finally {
      setBusy(false)
    }
  }

  const deleteForm = async () => {
    if (!signupData) return
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
      setSavedDraft(JSON.stringify(draft))
      toast('Sign-up deleted.')
      onClose()
    } catch (e) {
      toast(`Error: ${e instanceof Error ? e.message : e}`, { isError: true })
    }
  }

  const close = () => (!isDirty || window.confirm(DISCARD_CONFIRM)) && onClose()

  if (!isLoaded) return <div className="text-center">Loading…</div>

  const tabClass = (active: boolean) =>
    `px-4 py-2 -mb-px border-b-2 ${active ? 'border-red' : 'border-transparent text-lightgray hover:text-red'}`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button type="button" className="borderbutton" onClick={close}>
          ← {backLabel ?? target.event.name}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-normal mr-2">Sign-up: {label}</h2>
        <a
          href={`/events/${target.event.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={iconLink}
          title="Event page"
          aria-label="Event page"
        >
          <FaExternalLinkAlt size={14} />
        </a>
        <button
          type="button"
          onClick={() => setIsCopyOpen(true)}
          className={iconLink}
          title="Copy sign-up from another event"
          aria-label="Copy sign-up from another event"
        >
          <FaCopy size={14} />
        </button>
      </div>

      <div className="flex border-b border-lightgray">
        <button type="button" className={tabClass(tab === 'fields')} onClick={() => setTab('fields')}>
          Sign-up fields
        </button>
        <button
          type="button"
          className={tabClass(tab === 'signups')}
          onClick={() => setTab('signups')}
        >
          Signed up{signupData ? ` (${participants.length})` : ''}
        </button>
      </div>

      {tab === 'fields' ? (
        <form onSubmit={save} className="flex flex-col lg:flex-row gap-8 lg:items-start xl:w-3/4">
          <div className="flex-1 min-w-0 flex flex-col gap-8">
            {!signupData && (
              <div className="text-sm text-lightgray">
                This sign-up form is created when you save.
              </div>
            )}
            <SignupFormSettings value={draft} onChange={setDraft} eventStart={selectedStart} />
            <SignupFieldsEditor
              value={draft}
              onChange={setDraft}
              hasSignups={participants.length > 0}
            />
          </div>
          <div className="sticky bottom-0 lg:bottom-auto lg:top-24 z-10 lg:w-56 shrink-0 flex flex-col gap-2 bg-white text-black border border-gray-300 rounded-md p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="mainbutton flex items-center gap-2"
                disabled={busy || !isDirty || hasDuplicateIds || duplicatePoolNames}
              >
                <FaSave size={14} />
                Save
              </button>
              <button
                type="button"
                className="borderbutton flex items-center gap-2"
                onClick={() => setIsPreviewOpen(true)}
                title="Try the form as a participant. Nothing is saved."
              >
                <FaEye size={14} />
                Preview
              </button>
              {isDirty && (
                <button
                  type="button"
                  className="borderbutton"
                  onClick={() => setDraft(JSON.parse(savedDraft))}
                  disabled={busy}
                  title="Discard changes"
                  aria-label="Discard changes"
                >
                  <FaUndo size={14} />
                </button>
              )}
              {signupData && (
                <button
                  type="button"
                  className="borderbutton hover:!text-red"
                  onClick={deleteForm}
                  disabled={busy}
                  title="Delete the entire sign-up"
                  aria-label="Delete the entire sign-up"
                >
                  <FaTrash size={14} />
                </button>
              )}
            </div>
            {isDirty && <div className="text-sm text-lightgray">Unsaved changes</div>}
            {hasDuplicateIds && (
              <div className="text-sm text-red">Two or more fields share the same ID.</div>
            )}
          </div>
        </form>
      ) : !signupData || participants.length === 0 ? (
        <div className="text-lightgray">No one has signed up yet.</div>
      ) : (
        <ParticipantTable
          signupData={signupData}
          participants={participants}
          showPrivateData
          allowEdit
          onChange={() => loadParticipants(signupData.key)}
          csvName={`signups-${signupData.key.replace(/[^a-z0-9-]+/gi, '-')}`}
        />
      )}

      {isPreviewOpen && (
        <SignupPreview
          target={target}
          draft={draft}
          participants={signupData ? participants : []}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
      {isCopyOpen && (
        <CopySignupDialog
          targetKey={target.key}
          targetLabel={label}
          labels={targetOptions.map(({ key, label }) => ({ value: key, label }))}
          participantCount={signupData ? participants.length : 0}
          onClose={() => setIsCopyOpen(false)}
          onCopied={async () => {
            await loadTarget()
            toast('Sign-up copied!')
          }}
        />
      )}
    </div>
  )
}

export default SignupEditor
