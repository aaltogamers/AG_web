import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import {
  FaCopy,
  FaEdit,
  FaExternalLinkAlt,
  FaEye,
  FaSave,
  FaTrash,
  FaUndo,
} from 'react-icons/fa'
import { AGEvent, SignupRow } from '../types/types'
import {
  DEFAULT_EVENT_IMAGE,
  eventMoment,
  getSignupTargetLabel,
  getSignupTargets,
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
  events: AGEvent[]
}

type Tab = 'fields' | 'signups'

const DISCARD_CONFIRM = 'You have unsaved changes. Discard them?'

const iconLink =
  'p-2 rounded-md border border-lightgray bg-white hover:border-red hover:text-red text-black'

const SignUpCreateForm = ({ events }: Props) => {
  const router = useRouter()
  const toast = useToast()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [signupData, setSignupData] = useState<SignupEvent | null>(null)
  const [participants, setParticipants] = useState<SignupRow[]>([])
  const [draft, setDraft] = useState<FormDraft>(emptyFormDraft())
  const [savedDraft, setSavedDraft] = useState(() => JSON.stringify(draft))
  const [tab, setTab] = useState<Tab>('fields')
  const [busy, setBusy] = useState(false)
  const [isCopyOpen, setIsCopyOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())

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
  const labelFor = (key: string) => targetOptions.find((o) => o.key === key)?.label ?? key

  const selectedTarget = targets.find((t) => t.key === selectedKey)
  // Presets in the time pickers are relative to this, in the browser's local time
  const selectedStart = selectedTarget ? (startOf(selectedTarget)?.clone().local() ?? null) : null

  const isDirty = JSON.stringify(draft) !== savedDraft

  const loadParticipants = async (signupKey: string) => {
    const { signups } = await listSignups(signupKey)
    setParticipants(signups)
  }

  const loadTarget = async (key: string) => {
    setSelectedKey(key)
    const event = await getSignupEvent(key)
    const loaded = event ? formToDraft(event) : emptyFormDraft()
    setDraft(loaded)
    setSavedDraft(JSON.stringify(loaded))
    setSignupData(event)
    if (event) await loadParticipants(event.key)
    else setParticipants([])
  }

  const select = (key: string) => {
    if (key === selectedKey || (isDirty && !window.confirm(DISCARD_CONFIRM))) return
    loadTarget(key)
  }

  useEffect(() => {
    if (!router.isReady) return
    // `?event=<sign-up key or event slug>` (from the event page) preselects that event once
    const requested = typeof router.query.event === 'string' ? router.query.event : null
    const requestedTarget = requested
      ? (targets.find((t) => t.key === requested) ??
        targets.find((t) => t.event.slug === requested))
      : undefined
    const initial = requestedTarget ?? targets[0]
    if (initial) loadTarget(initial.key)
    if (requested) {
      const query = { ...router.query }
      delete query.event
      router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  // Keeps the selected event visible in the row of events
  useEffect(() => {
    if (!selectedKey) return
    cardRefs.current.get(selectedKey)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selectedKey])

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
    if (!selectedKey) return
    const result = draftToForm(draft)
    if ('error' in result) {
      toast(`Error: ${result.error}`, { isError: true })
      return
    }
    setBusy(true)
    try {
      const saved = await saveSignupEvent({ key: selectedKey, ...result.form })
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

  const deleteEvent = async () => {
    if (!signupData) return
    const label = labelFor(signupData.key)
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
      const empty = emptyFormDraft()
      setDraft(empty)
      setSavedDraft(JSON.stringify(empty))
      setSignupData(null)
      setParticipants([])
      toast('Sign-up deleted.')
    } catch (e) {
      toast(`Error: ${e instanceof Error ? e.message : e}`, { isError: true })
    }
  }

  if (!targets.length) {
    return (
      <p className="text-center">
        No events have sign-ups enabled. Choose a sign-up option for an event in the CMS.
      </p>
    )
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 -mb-px border-b-2 ${active ? 'border-red' : 'border-transparent text-lightgray hover:text-red'}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {targets.map((target) => {
          const isSelected = target.key === selectedKey
          const start = startOf(target)
          const isDefaultImage = !target.event.image || target.event.image === DEFAULT_EVENT_IMAGE
          return (
            <button
              key={target.key}
              ref={(el) => {
                if (el) cardRefs.current.set(target.key, el)
                else cardRefs.current.delete(target.key)
              }}
              type="button"
              onClick={() => select(target.key)}
              className={`w-28 shrink-0 flex flex-col gap-1 text-left rounded-md p-1 border-2 ${
                isSelected ? 'border-red' : 'border-transparent hover:border-lightgray'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={target.event.image || DEFAULT_EVENT_IMAGE}
                alt=""
                loading="lazy"
                className={`w-full aspect-square rounded-md bg-black ${
                  isDefaultImage ? 'object-contain p-3' : 'object-cover'
                }`}
              />
              <span className="text-sm leading-tight line-clamp-2">{target.event.name}</span>
              <span className="text-xs text-lightgray">
                {target.session?.name ? `${target.session.name} · ` : ''}
                {start?.format('D.M.YYYY') ?? ''}
              </span>
            </button>
          )
        })}
      </div>

      {selectedTarget && (
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-normal mr-2">{labelFor(selectedTarget.key)}</h2>
          <a
            href={`/events/${selectedTarget.event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={iconLink}
            title="Event page"
            aria-label="Event page"
          >
            <FaExternalLinkAlt size={14} />
          </a>
          <a
            href={`/cms/#/collections/event/entries/${selectedTarget.event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={iconLink}
            title="Edit event info in the CMS"
            aria-label="Edit event info in the CMS"
          >
            <FaEdit size={14} />
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
      )}

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
        <form onSubmit={save} className="flex flex-col lg:flex-row gap-8 lg:items-start">
          <div className="flex-1 min-w-0 flex flex-col gap-8">
            {!signupData && (
              <div className="text-sm text-lightgray">
                This event has no sign-up form yet. It is created when you save.
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
                disabled={!selectedTarget}
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
                  onClick={deleteEvent}
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

      {isPreviewOpen && selectedTarget && (
        <SignupPreview
          target={selectedTarget}
          draft={draft}
          participants={signupData ? participants : []}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
      {isCopyOpen && selectedTarget && (
        <CopySignupDialog
          targetKey={selectedTarget.key}
          targetLabel={labelFor(selectedTarget.key)}
          labels={targetOptions.map(({ key, label }) => ({ value: key, label }))}
          participantCount={signupData ? participants.length : 0}
          onClose={() => setIsCopyOpen(false)}
          onCopied={async () => {
            await loadTarget(selectedTarget.key)
            toast('Sign-up copied!')
          }}
        />
      )}
    </div>
  )
}

export default SignUpCreateForm
