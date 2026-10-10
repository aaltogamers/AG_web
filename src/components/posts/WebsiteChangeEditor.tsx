import { useEffect, useState } from 'react'
import moment from 'moment-timezone'
import { FaTrash } from 'react-icons/fa'
import type { AGEvent, SignupMode } from '../../types/types'
import { EVENT_TIMEZONE, eventMoment } from '../../utils/eventUtils'
import { getSignupEvent, listSignupEvents, type SignupEvent } from '../../utils/signupApi'
import { imagePreviewUrl, type PostImage, type WebsiteChangePreview } from '../../utils/social/types'
import {
  emptyFormDraft,
  formToDraft,
  SignupFieldsEditor,
  SignupFormSettings,
  type FormDraft,
} from '../SignupFormEditor'
import {
  emptyEventDraft,
  eventToDraft,
  randomSessionId,
  type EventDraft,
  type EventField,
  type SessionDraft,
  type TextDraft,
  type WebsiteChangeDraft,
} from './postDraft'

type Props = {
  value: WebsiteChangeDraft
  onChange: (change: WebsiteChangeDraft) => void
  events: AGEvent[]
  postImages: PostImage[]
  preview: WebsiteChangePreview | null
  leadMinutes: number
}

const inputClass = 'p-2 rounded-md bg-white text-black w-full'

const FIELD_LABELS: Record<EventField, string> = {
  name: 'Name',
  sessions: 'Times and places',
  signupMode: 'Sign-up',
  image: 'Image',
  visibleOnEventsPage: 'Shown on events page',
  visibleOnCalendar: 'Shown on calendar',
  description: 'Short description',
  body: 'Long description',
}
const FIELDS: EventField[] = [
  'name',
  'sessions',
  'signupMode',
  'image',
  'visibleOnEventsPage',
  'visibleOnCalendar',
  'description',
  'body',
]

const byNewest = (events: AGEvent[]) =>
  [...events].sort(
    (a, b) =>
      (b.sessions[0] ? eventMoment(b.sessions[0].start).valueOf() : 0) -
      (a.sessions[0] ? eventMoment(a.sessions[0].start).valueOf() : 0)
  )

const eventLabel = (e: AGEvent) =>
  `${e.name}${e.sessions[0] ? ` (${eventMoment(e.sessions[0].start).format('D.M.YYYY')})` : ''}`

const TextChoiceInput = ({
  value,
  onChange,
  rows,
}: {
  value: TextDraft
  onChange: (value: TextDraft) => void
  rows: number
}) => (
  <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={value.fromPost}
        onChange={(e) => onChange({ ...value, fromPost: e.target.checked })}
      />
      Use the post&apos;s text
    </label>
    {!value.fromPost && (
      <textarea
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        rows={rows}
        className={`${inputClass} font-mono text-sm`}
      />
    )}
  </div>
)

const SessionsInput = ({
  value,
  onChange,
}: {
  value: SessionDraft[]
  onChange: (sessions: SessionDraft[]) => void
}) => {
  const update = (id: string, changes: Partial<SessionDraft>) =>
    onChange(value.map((s) => (s.id === id ? { ...s, ...changes } : s)))
  // A new session a week after the last one, e.g. the next date of a weekly event
  const add = () => {
    const last = value[value.length - 1]
    const shift = (t: string) => (t ? moment(t).add(1, 'week').format('YYYY-MM-DDTHH:mm') : '')
    onChange([
      ...value,
      last
        ? { ...last, id: randomSessionId(), start: shift(last.start), end: shift(last.end) }
        : { id: randomSessionId(), name: '', start: '', end: '', location: '' },
    ])
  }
  return (
    <div className="flex flex-col gap-3">
      {value.map((s) => (
        <div key={s.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-lightgray/40 rounded-md p-2">
          <input
            value={s.name}
            onChange={(e) => update(s.id, { name: e.target.value })}
            placeholder="Name (optional), e.g. Finals"
            className={inputClass}
          />
          <input
            value={s.location}
            onChange={(e) => update(s.id, { location: e.target.value })}
            placeholder="Location"
            className={inputClass}
          />
          <label className="text-sm">
            Start
            <input
              type="datetime-local"
              value={s.start}
              onChange={(e) => update(s.id, { start: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            End
            <input
              type="datetime-local"
              value={s.end}
              onChange={(e) => update(s.id, { end: e.target.value })}
              className={inputClass}
            />
          </label>
          <div className="md:col-span-2 flex justify-between text-xs text-lightgray">
            <span>Helsinki time · id {s.id}</span>
            <button type="button" className="hover:text-red" onClick={() => onChange(value.filter((o) => o.id !== s.id))}>
              <FaTrash />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="link text-sm self-start" onClick={add}>
        + Add session
      </button>
    </div>
  )
}

// One sign-up form of the change: created or replaced when the change runs
const FormSlot = ({
  label,
  draft,
  eventStart,
  onChange,
  onRemove,
  existingCount,
  copySources,
  events,
}: {
  label: string
  draft: FormDraft
  eventStart: moment.Moment | null
  onChange: (draft: FormDraft) => void
  onRemove: () => void
  existingCount: number | null
  copySources: SignupEvent[]
  events: AGEvent[]
}) => {
  // Copies another form, with its times moved by as much as the sessions are apart
  const copyFrom = async (key: string) => {
    const source = await getSignupEvent(key)
    if (!source) return
    const [slug, sessionId] = key.split(':')
    const sourceEvent = events.find((e) => e.slug === slug)
    const sourceSession = sessionId
      ? sourceEvent?.sessions.find((s) => s.id === sessionId)
      : sourceEvent?.sessions[0]
    const shiftMs =
      eventStart && sourceSession ? eventStart.valueOf() - eventMoment(sourceSession.start).valueOf() : 0
    const shift = (iso: string) => new Date(new Date(iso).getTime() + shiftMs).toISOString()
    onChange(
      formToDraft({ ...source, openfrom: shift(source.openfrom), openuntil: shift(source.openuntil) })
    )
  }
  const sourceLabel = (key: string) => {
    const [slug, sessionId] = key.split(':')
    const event = events.find((e) => e.slug === slug)
    const session = event?.sessions.find((s) => s.id === sessionId)
    return event
      ? `${event.name}${session ? ` – ${session.name || eventMoment(session.start).format('D.M.YYYY')}` : ''}`
      : key
  }

  return (
    <div className="border border-lightgray/40 rounded-md p-3 flex flex-col gap-2">
      <div className="flex justify-between items-center gap-2">
        <h4 className="text-lg">📝 Sign-up form: {label}</h4>
        <button type="button" className="text-sm link" onClick={onRemove}>
          Don&apos;t change the form
        </button>
      </div>
      {existingCount !== null && existingCount > 0 && (
        <div className="text-yellow-400 text-sm">
          ⚠️ This form already has {existingCount} sign-up(s). Pools with sign-ups and answered questions
          can&apos;t be removed.
        </div>
      )}
      <select
        value=""
        onChange={(e) => e.target.value && copyFrom(e.target.value)}
        className="p-2 rounded-md bg-white text-black text-sm"
      >
        <option value="">Copy another event&apos;s form as a starting point…</option>
        {copySources.map((f) => (
          <option key={f.key} value={f.key}>
            {sourceLabel(f.key)}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(10rem,14rem)_1fr]">
        <SignupFormSettings value={draft} onChange={onChange} eventStart={eventStart} />
      </div>
      <SignupFieldsEditor value={draft} onChange={onChange} />
    </div>
  )
}

const WebsiteChangeEditor = ({ value, onChange, events, postImages, preview, leadMinutes }: Props) => {
  const [copySources, setCopySources] = useState<SignupEvent[]>([])
  useEffect(() => {
    listSignupEvents().then(setCopySources)
  }, [])

  const set = (changes: Partial<WebsiteChangeDraft>) => onChange({ ...value, ...changes })
  const setEvent = (field: EventField, fieldValue: EventDraft[EventField]) =>
    set({
      event: { ...value.event, [field]: fieldValue },
      changed: value.changed.includes(field) ? value.changed : [...value.changed, field],
    })
  const isCreate = value.kind === 'create_event'
  const isOn = (field: EventField) => isCreate || value.changed.includes(field)
  const current = events.find((e) => e.slug === value.eventSlug)
  const sortedEvents = byNewest(events)

  const toggleField = (field: EventField, on: boolean) => {
    if (!on) {
      // Back to the event's current value
      const reset = current ? eventToDraft(current)[field] : emptyEventDraft()[field]
      set({ changed: value.changed.filter((f) => f !== field), event: { ...value.event, [field]: reset } })
    } else {
      set({ changed: [...value.changed, field] })
    }
  }

  // The forms the event can have after the change
  const mode: SignupMode = value.event.signupMode
  const slots =
    mode === 'event'
      ? [{ sessionId: undefined as string | undefined, label: 'Whole event', start: value.event.sessions[0]?.start }]
      : mode === 'session'
        ? value.event.sessions.map((s) => ({
            sessionId: s.id as string | undefined,
            label: s.name || (s.start ? moment(s.start).format('ddd D.M.YYYY HH:mm') : 'New session'),
            start: s.start,
          }))
        : []
  const formKey = (sessionId?: string) =>
    value.eventSlug ? (sessionId ? `${value.eventSlug}:${sessionId}` : value.eventSlug) : null

  const enableForm = async (sessionId?: string) => {
    const key = !isCreate ? formKey(sessionId) : null
    const existing = key ? await getSignupEvent(key) : null
    set({ forms: [...value.forms, { sessionId, draft: existing ? formToDraft(existing) : emptyFormDraft() }] })
  }
  const orphanForms = value.forms.filter((f) => !slots.some((s) => s.sessionId === f.sessionId))

  const renderField = (field: EventField) => {
    const e = value.event
    switch (field) {
      case 'name':
        return <input value={e.name} onChange={(ev) => setEvent('name', ev.target.value)} className={inputClass} />
      case 'sessions':
        return <SessionsInput value={e.sessions} onChange={(s) => setEvent('sessions', s)} />
      case 'signupMode':
        return (
          <select
            value={e.signupMode}
            onChange={(ev) => setEvent('signupMode', ev.target.value as SignupMode)}
            className={inputClass}
          >
            <option value="none">No sign-up</option>
            <option value="event">One sign-up for the whole event</option>
            <option value="session">A separate sign-up for each session</option>
          </select>
        )
      case 'image': {
        const choice = e.image
        const key = !choice ? 'none' : 'postImage' in choice ? `post:${choice.postImage}` : `site:${choice.sitePath}`
        return (
          <div className="flex flex-col gap-2">
            <select
              value={key}
              onChange={(ev) => {
                const v = ev.target.value
                setEvent(
                  'image',
                  v === 'none' ? null : v.startsWith('post:') ? { postImage: Number(v.slice(5)) } : { sitePath: v.slice(5) }
                )
              }}
              className={inputClass}
            >
              <option value="none">No image (the AG logo)</option>
              {postImages.map((img, i) => (
                <option key={i} value={`post:${i}`}>
                  Image {i + 1} of the post{'sitePath' in img ? ` (${img.sitePath})` : ' (uploaded; added to the site)'}
                </option>
              ))}
              {choice && 'sitePath' in choice && <option value={key}>{choice.sitePath}</option>}
            </select>
            {choice && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={'sitePath' in choice ? choice.sitePath : postImages[choice.postImage] ? imagePreviewUrl(postImages[choice.postImage]) : ''}
                alt=""
                className="h-24 object-contain self-start"
              />
            )}
          </div>
        )
      }
      case 'visibleOnEventsPage':
      case 'visibleOnCalendar':
        return (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={e[field]} onChange={(ev) => setEvent(field, ev.target.checked)} />
            {e[field] ? 'Shown' : 'Hidden'}
          </label>
        )
      case 'description':
        return <TextChoiceInput value={e.description} onChange={(t) => setEvent('description', t)} rows={3} />
      case 'body':
        return <TextChoiceInput value={e.body} onChange={(t) => setEvent('body', t)} rows={8} />
    }
  }

  if (value.locked) {
    return <div className="text-lightgray">The website change has already run and can&apos;t be changed.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {(['create_event', 'update_event'] as const).map((kind) => (
          <label key={kind} className="flex items-center gap-2">
            <input
              type="radio"
              checked={value.kind === kind}
              onChange={() =>
                set({ kind, eventSlug: '', event: emptyEventDraft(), changed: [], forms: [] })
              }
            />
            {kind === 'create_event' ? 'Create a new event' : 'Change an existing event'}
          </label>
        ))}
      </div>

      {isCreate ? (
        <select
          value=""
          onChange={(ev) => {
            const source = events.find((e) => e.slug === ev.target.value)
            if (source) set({ event: { ...eventToDraft(source, false) }, forms: [] })
          }}
          className={inputClass}
        >
          <option value="">Start from an existing event (copies texts, image and settings)…</option>
          {sortedEvents.map((e) => (
            <option key={e.slug} value={e.slug}>
              {eventLabel(e)}
            </option>
          ))}
        </select>
      ) : (
        <select
          value={value.eventSlug}
          onChange={(ev) => {
            const event = events.find((e) => e.slug === ev.target.value)
            set({ eventSlug: ev.target.value, event: event ? eventToDraft(event) : emptyEventDraft(), changed: [], forms: [] })
          }}
          className={inputClass}
        >
          <option value="">Choose the event to change…</option>
          {sortedEvents.map((e) => (
            <option key={e.slug} value={e.slug}>
              {eventLabel(e)}
            </option>
          ))}
        </select>
      )}

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={value.ownTime} onChange={(e) => set({ ownTime: e.target.checked })} />
          Own time for the website change
        </label>
        {value.ownTime ? (
          <input type="datetime-local" value={value.runAt} onChange={(e) => set({ runAt: e.target.value })} className={inputClass} />
        ) : (
          <div className="text-sm text-lightgray">
            {leadMinutes} minutes before the first message. The site is rebuilt 2–3 minutes after the change.
          </div>
        )}
      </div>

      {(isCreate || value.eventSlug) && (
        <div className="flex flex-col gap-4">
          {FIELDS.map((field) => (
            <div key={field} className="flex flex-col gap-1">
              <label className="flex items-center gap-2 font-bold">
                {!isCreate && (
                  <input type="checkbox" checked={isOn(field)} onChange={(e) => toggleField(field, e.target.checked)} />
                )}
                {FIELD_LABELS[field]}
                {!isCreate && !isOn(field) && <span className="font-normal text-sm text-lightgray">(not changed)</span>}
              </label>
              {isOn(field) && renderField(field)}
            </div>
          ))}
        </div>
      )}

      {(isCreate || value.eventSlug) && slots.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-lg">Sign-up forms</h4>
          <div className="text-sm text-lightgray">
            Forms are saved when the change runs, and open at their own time.
          </div>
          {slots.map((slot) => {
            const form = value.forms.find((f) => f.sessionId === slot.sessionId)
            const key = formKey(slot.sessionId)
            const info = preview?.forms.find((f) => f.key === key)
            const start = slot.start ? moment.tz(slot.start, EVENT_TIMEZONE).local() : null
            return form ? (
              <FormSlot
                key={slot.sessionId ?? 'event'}
                label={slot.label}
                draft={form.draft}
                eventStart={start}
                existingCount={info && !info.isNew ? info.signups : null}
                copySources={copySources}
                events={events}
                onChange={(draft) =>
                  set({ forms: value.forms.map((f) => (f.sessionId === slot.sessionId ? { ...f, draft } : f)) })
                }
                onRemove={() => set({ forms: value.forms.filter((f) => f.sessionId !== slot.sessionId) })}
              />
            ) : (
              <button
                key={slot.sessionId ?? 'event'}
                type="button"
                className="borderbutton self-start text-base"
                onClick={() => enableForm(slot.sessionId)}
              >
                Create or change the sign-up form: {slot.label}
              </button>
            )
          })}
          {orphanForms.map((f) => (
            <div key={f.sessionId ?? 'event'} className="text-red text-sm flex gap-2 items-center">
              A sign-up form is for a session or sign-up mode the event no longer has.
              <button type="button" className="link" onClick={() => set({ forms: value.forms.filter((o) => o !== f) })}>
                Remove it
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WebsiteChangeEditor
