import { useEffect, useState } from 'react'
import moment from 'moment-timezone'
import { FaRegClock, FaTrash } from 'react-icons/fa'
import type { AGEvent, SignupMode } from '../../types/types'
import { EVENT_TIMEZONE, eventMoment } from '../../utils/eventUtils'
import { getSignupEvent, listSignupEvents, type SignupEvent } from '../../utils/signupApi'
import type { WebsiteChangePreview } from '../../utils/social/types'
import {
  emptyFormDraft,
  formToDraft,
  SignupFieldsEditor,
  SignupFormSettings,
  type FormDraft,
} from '../SignupFormEditor'
import MarkdownEditor from './MarkdownEditor'
import PostTimePicker from './PostTimePicker'
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
  preview: WebsiteChangePreview | null
  leadMinutes: number
  // When the post's event starts, for the time presets
  eventStart: moment.Moment | null
}

const inputClass = 'p-2 rounded-md bg-white text-black w-full border border-gray-300'

// The image and visibility aren't edited here: a new event gets the post's first
// image (or the AG logo) and is shown everywhere, and a changed event keeps them
type EditedField = Exclude<EventField, 'image' | 'visibleOnCalendar' | 'visibleOnEventsPage'>
const FIELD_LABELS: Record<EditedField, string> = {
  name: 'Name',
  sessions: 'Times and places',
  signupMode: 'Sign-up',
  description: 'Short description',
  body: 'Long description',
}
const FIELDS: EditedField[] = ['name', 'sessions', 'signupMode', 'description', 'body']

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
      <MarkdownEditor value={value.text} onChange={(text) => onChange({ ...value, text })} rows={rows} placeholders={null} />
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
          <div className="text-sm">
            Start
            <PostTimePicker
              value={s.start}
              onChange={(start) => update(s.id, { start })}
              eventStart={null}
              eventPresets={false}
              defaultTime={moment().hour(18).minute(0)}
            />
          </div>
          <div className="text-sm">
            End
            <PostTimePicker
              value={s.end}
              onChange={(end) => update(s.id, { end })}
              eventStart={s.start ? moment(s.start) : null}
              eventPresets={false}
              extraPresets={
                s.start
                  ? [1, 2, 3, 4].map((hours) => ({
                      label: `${hours} hour${hours > 1 ? 's' : ''} after start`,
                      icon: <FaRegClock />,
                      time: moment(s.start).add(hours, 'hours'),
                    }))
                  : []
              }
              clearable
              placeholder="Same as start"
            />
          </div>
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

const WebsiteChangeEditor = ({ value, onChange, events, preview, leadMinutes, eventStart }: Props) => {
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

  const renderField = (field: EditedField) => {
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
      <div>
        {isCreate ? (
          <>
            <b>Creates a new event.</b>{' '}
            <span className="text-sm text-lightgray">Choose the post&apos;s event above to change an existing one instead.</span>
          </>
        ) : (
          <b>Changes the event {current ? eventLabel(current) : value.eventSlug}.</b>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-bold">Update the website</span>
        {(
          [
            ['on_approval', 'When the post is approved'],
            ['before_post', `${leadMinutes} minutes before the first message`],
            ['at', 'At a set time'],
          ] as const
        ).map(([timing, label]) => (
          <label key={timing} className="flex items-center gap-2">
            <input
              type="radio"
              name="website-change-timing"
              checked={value.timing === timing}
              onChange={() => set({ timing })}
            />
            {label}
          </label>
        ))}
        {value.timing === 'at' && (
          <PostTimePicker value={value.runAt} onChange={(runAt) => set({ runAt })} eventStart={eventStart} />
        )}
        <div className="text-sm text-lightgray">The site is rebuilt 2–3 minutes after the change.</div>
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
                {field === 'body' && isOn(field) && (
                  <span className="font-normal text-sm text-lightgray">(optional; empty uses the short description)</span>
                )}
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
