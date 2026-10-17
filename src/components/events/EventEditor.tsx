import { useEffect, useMemo, useState } from 'react'
import { FaTrash } from 'react-icons/fa'
import type { AGEvent, SignupMode } from '../../types/types'
import type { StoredEvent } from '../../utils/eventStore'
import { DEFAULT_EVENT_IMAGE } from '../../utils/eventUtils'
import { createEvent, deleteEvent, updateEvent, uploadEventImage } from '../../utils/eventsClient'
import EventPostsList from './EventPostsList'
import EventImageDialog from './EventImageDialog'
import EventSignupsList from './EventSignupsList'
import MarkdownEditor from '../posts/MarkdownEditor'
import { inputClass, SessionsInput } from '../posts/WebsiteChangeEditor'
import WebsitePagePreview from '../posts/WebsitePagePreview'
import type { SessionDraft } from '../posts/postDraft'
import { useToast } from '../Toast'

type Recording = { name: string; url: string }

type Draft = {
  name: string
  sessions: SessionDraft[]
  // Not edited directly: adding a sign-up form sets it
  signupMode: SignupMode
  // Empty: the AG logo
  image: string
  visibleOnCalendar: boolean
  visibleOnEventsPage: boolean
  description: string
  body: string
  recordings: Recording[]
}

type Props = {
  // null for a new event
  event: StoredEvent | null
  // For picking another event's image
  siteEvents: AGEvent[]
  onSaved: (event: StoredEvent) => void
  onDeleted: () => void
  onClose: () => void
  // The label of the back button
  backLabel: string
  // Opens the editor of a sign-up form (by its key) or a post ('new' for a new one)
  onOpenSignup: (key: string) => void
  onOpenPost: (id: string) => void
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')

// Event times are Helsinki times like 2026-10-24T18:00:00; the time pickers leave out the seconds
const toPicker = (time: unknown) => str(time).slice(0, 16)
const fromPicker = (time: string) => (time ? `${time}:00` : '')

const toDraft = (event: StoredEvent | null): Draft => {
  const d = event?.data ?? {}
  const sessions = Array.isArray(d.sessions) ? (d.sessions as Record<string, unknown>[]) : []
  const recordings = Array.isArray(d.recordings) ? (d.recordings as Record<string, unknown>[]) : []
  return {
    name: str(d.name),
    sessions: sessions.map((s) => ({
      id: str(s.id),
      name: str(s.name),
      start: toPicker(s.start),
      end: toPicker(s.end),
      location: str(s.location),
    })),
    signupMode: (str(d.signupMode) || 'none') as SignupMode,
    image: str(d.image),
    visibleOnCalendar: d.visibleOnCalendar !== false,
    visibleOnEventsPage: d.visibleOnEventsPage !== false,
    description: str(d.description),
    body: event?.body ?? '',
    recordings: recordings.map((r) => ({ name: str(r.name), url: str(r.url) })),
  }
}

const toData = (draft: Draft): Record<string, unknown> => ({
  name: draft.name.trim(),
  sessions: draft.sessions.map((s) => ({
    ...(s.name.trim() && { name: s.name.trim() }),
    start: fromPicker(s.start),
    end: fromPicker(s.end || s.start),
    location: s.location.trim(),
    id: s.id,
  })),
  signupMode: draft.signupMode,
  ...(draft.image && { image: draft.image }),
  visibleOnCalendar: draft.visibleOnCalendar,
  visibleOnEventsPage: draft.visibleOnEventsPage,
  description: draft.description.trim(),
  recordings: draft.recordings
    .filter((r) => r.url.trim())
    .map((r) => ({ name: r.name.trim() || 'Recording', url: r.url.trim() })),
})

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="font-bold">{label}</span>
    {children}
    {hint && <span className="text-sm text-lightgray">{hint}</span>}
  </div>
)

const ImageInput = ({
  value,
  onChange,
  siteEvents,
}: {
  value: string
  onChange: (image: string) => void
  siteEvents: AGEvent[]
}) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPicking, setIsPicking] = useState(false)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange((await uploadEventImage(file)).url)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={value || DEFAULT_EVENT_IMAGE} alt="" className="h-32 w-fit max-w-full object-contain" />
      <div className="flex flex-wrap gap-2 text-base">
        <label className={`borderbutton cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy ? 'Uploading…' : 'Upload an image'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              upload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        <button type="button" className="borderbutton" onClick={() => setIsPicking(true)}>
          Pick existing event image
        </button>
        {value && (
          <button type="button" className="borderbutton" onClick={() => onChange('')}>
            Remove image
          </button>
        )}
      </div>
      {error && <div className="text-red text-sm">{error}</div>}
      {isPicking && (
        <EventImageDialog
          events={siteEvents}
          onClose={() => setIsPicking(false)}
          onPick={(path) => {
            onChange(path)
            setIsPicking(false)
          }}
        />
      )}
    </div>
  )
}

const RecordingsInput = ({ value, onChange }: { value: Recording[]; onChange: (value: Recording[]) => void }) => {
  const update = (i: number, changes: Partial<Recording>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...changes } : r)))
  return (
    <div className="flex flex-col gap-2">
      {value.map((r, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={r.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Name, e.g. Finals"
            className={`${inputClass} md:w-1/3`}
          />
          <input
            value={r.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="URL, e.g. a YouTube link"
            className={inputClass}
          />
          <button
            type="button"
            aria-label="Remove recording"
            className="hover:text-red"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <FaTrash />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="borderbutton self-start"
        onClick={() => onChange([...value, { name: 'Recording', url: '' }])}
      >
        + Add recording
      </button>
    </div>
  )
}

// Creates or edits an event. It is on the site as soon as it is saved.
const EventEditor = ({ event, siteEvents, onSaved, onDeleted, onClose, backLabel, onOpenSignup, onOpenPost }: Props) => {
  const toast = useToast()
  const initial = useMemo(() => toDraft(event), [event])
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const set = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }))

  useEffect(() => {
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const page = useMemo(
    () => ({
      event: { ...toData(draft), content: draft.body, slug: event?.slug ?? 'new-event' },
      imageUrls: {},
    }),
    [draft, event?.slug]
  )

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), { isError: true })
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      if (!event) {
        const { event: created } = await createEvent(toData(draft), draft.body)
        toast(`Created; it is on /events/${created.slug} now.`)
        onSaved(created)
        return
      }
      const result = await updateEvent(event.slug, event.version, toData(draft), draft.body)
      toast(
        result.deletedSignupForms.length
          ? `Saved. Deleted the empty sign-up forms: ${result.deletedSignupForms.join(', ')}`
          : 'Saved; the change is on the site now.'
      )
      onSaved(result.event)
    })

  const remove = () =>
    event &&
    window.confirm(`Delete the event "${draft.name}"? Its empty sign-up forms are deleted too.`) &&
    run(async () => {
      await deleteEvent(event.slug, event.version)
      toast('Deleted.')
      onDeleted()
    })

  const confirmLeave = () => !isDirty || window.confirm('Discard your unsaved changes?')
  const close = () => confirmLeave() && onClose()

  // Adding a sign-up form of another kind than the event has changes the event's sign-up mode first
  const addSignup = (mode: SignupMode, key: string) =>
    event &&
    run(async () => {
      if (mode !== initial.signupMode) {
        const result = await updateEvent(event.slug, event.version, toData({ ...initial, signupMode: mode }), initial.body)
        onSaved(result.event)
      }
      onOpenSignup(key)
    })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <button type="button" className="borderbutton" onClick={close}>
          ← {backLabel}
        </button>
        {event && (
          <a href={`/events/${event.slug}`} target="_blank" rel="noreferrer" className="link">
            /events/{event.slug}
          </a>
        )}
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/2 min-w-0 flex flex-col gap-6">
          <Field label="Name" hint={event ? undefined : "The event's address is made from it when it is created."}>
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
          </Field>
          <Field
            label="Sessions"
            hint="One per day or part of the event, e.g. Qualifiers and Finals. Leave empty if the time is not known yet. Times are Helsinki times."
          >
            <SessionsInput value={draft.sessions} onChange={(sessions) => set({ sessions })} />
          </Field>
          <Field label="Sign-ups">
            {event ? (
              <EventSignupsList
                event={event}
                disabled={busy || isDirty}
                onOpen={(key) => confirmLeave() && onOpenSignup(key)}
                onAdd={addSignup}
              />
            ) : (
              <span className="text-sm text-lightgray">Sign-up forms can be added once the event is created.</span>
            )}
          </Field>
          <Field label="Posts">
            {event ? (
              <EventPostsList eventSlug={event.slug} onOpen={(id) => confirmLeave() && onOpenPost(id)} />
            ) : (
              <span className="text-sm text-lightgray">Posts can be added once the event is created.</span>
            )}
          </Field>
          <Field label="Image">
            <ImageInput value={draft.image} onChange={(image) => set({ image })} siteEvents={siteEvents} />
          </Field>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.visibleOnEventsPage}
                onChange={(e) => set({ visibleOnEventsPage: e.target.checked })}
              />
              Shown on the events page
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.visibleOnCalendar}
                onChange={(e) => set({ visibleOnCalendar: e.target.checked })}
              />
              Shown on the calendar
            </label>
          </div>
          <Field label="Short description" hint="Shown in the event list.">
            <MarkdownEditor
              value={draft.description}
              onChange={(description) => set({ description })}
              rows={3}
              placeholders={null}
            />
          </Field>
          <Field
            label="Long description"
            hint="Shown on the event page, below the sessions. If empty, the short description is shown there instead."
          >
            <MarkdownEditor value={draft.body} onChange={(body) => set({ body })} rows={10} placeholders={null} />
          </Field>
          <Field label="Recordings">
            <RecordingsInput value={draft.recordings} onChange={(recordings) => set({ recordings })} />
          </Field>
        </div>

        <div className="lg:w-1/2 min-w-0 flex flex-col gap-4">
          <div className="lg:sticky lg:top-24 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="mainbutton" disabled={busy || !isDirty} onClick={save}>
                {event ? 'Save' : 'Create event'}
              </button>
              {isDirty && (
                <button type="button" className="borderbutton" disabled={busy} onClick={() => setDraft(initial)}>
                  Discard changes
                </button>
              )}
              {event && (
                <button type="button" className="borderbutton hover:!text-red" disabled={busy} onClick={remove}>
                  Delete event
                </button>
              )}
            </div>
            <WebsitePagePreview page={page} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default EventEditor
