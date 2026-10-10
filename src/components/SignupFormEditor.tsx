// Controlled sign-up form editor, used by the Signups tab and the website change
// editor of posts. Turn the FormDraft into SignUpData with draftToForm.
import moment, { Moment } from 'moment'
import { FaLock, FaLockOpen, FaTrash } from 'react-icons/fa'
import type { EditableInputType, SignupInput, SignupPool, SignUpData } from '../types/types'
import { defaultPools } from '../utils/signupPools'
import EditableInput from './EditableInput'
import SignupTimePicker from './SignupTimePicker'

// Field values as typed: the id and the select options are kept as text
export type FieldDraft = {
  // React key, stable while the field moves
  key: number
  id: string
  type: EditableInputType
  title: string
  description: string
  options: string
  required: boolean
  public: boolean
  multi: boolean
}

export type FormDraft = {
  // datetime-local values in the browser's time
  openfrom: string
  openuntil: string
  pools: SignupPool[]
  fields: FieldDraft[]
  confirmedMessage: string
  confirmedLink: string
}

const LOCAL_FORMAT = 'YYYY-MM-DDTHH:mm'

let nextKey = 1

export const emptyFormDraft = (): FormDraft => ({
  openfrom: '',
  openuntil: '',
  pools: defaultPools(),
  fields: [],
  confirmedMessage: '',
  confirmedLink: '',
})

export const formToDraft = (form: Omit<SignUpData, 'key'>): FormDraft => ({
  openfrom: form.openfrom ? moment(form.openfrom).format(LOCAL_FORMAT) : '',
  openuntil: form.openuntil ? moment(form.openuntil).format(LOCAL_FORMAT) : '',
  pools: form.pools?.length ? form.pools : defaultPools(),
  fields: (form.inputs ?? []).map((input) => ({
    key: nextKey++,
    id: String(input.id ?? ''),
    type: input.type,
    title: input.title ?? '',
    description: input.description ?? '',
    options: (input.options ?? []).join(', '),
    required: !!input.required,
    public: !!input.public,
    multi: !!input.multi,
  })),
  confirmedMessage: form.confirmedMessage ?? '',
  confirmedLink: form.confirmedLink ?? '',
})

export const duplicateFieldIds = (draft: FormDraft) => {
  const counts = new Map<number, number>()
  draft.fields.forEach((f) => {
    const n = Number(f.id)
    if (Number.isFinite(n) && n > 0) counts.set(n, (counts.get(n) ?? 0) + 1)
  })
  return new Set([...counts].filter(([, count]) => count > 1).map(([n]) => n))
}

export const hasDuplicatePoolNames = (draft: FormDraft) => {
  const names = draft.pools.map((p) => p.name.trim().toLowerCase())
  return new Set(names).size !== names.length
}

// The form to save, or what's wrong with it
export const draftToForm = (
  draft: FormDraft
): { form: Omit<SignUpData, 'key'> } | { error: string } => {
  if (duplicateFieldIds(draft).size) return { error: 'field IDs must be unique.' }
  if (hasDuplicatePoolNames(draft)) return { error: 'pool names must be unique.' }
  if (!draft.openfrom || !draft.openuntil) {
    return { error: 'choose when sign-up opens and closes.' }
  }

  // Explicit ids are kept; fields without one get the smallest free id
  const used = new Set(draft.fields.map((f) => Number(f.id)).filter((n) => Number.isFinite(n) && n > 0))
  let nextId = 1
  const inputs: SignupInput[] = draft.fields.map((f, i) => {
    let id = Number(f.id)
    if (!Number.isFinite(id) || id <= 0) {
      while (used.has(nextId)) nextId += 1
      id = nextId
      used.add(id)
    }
    const input: SignupInput = {
      id,
      number: i + 1,
      type: f.type,
      title: f.title,
      public: f.public,
      required: f.required,
    }
    if (f.description) input.description = f.description
    if (f.type === 'select') {
      input.options = f.options
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
      input.multi = f.multi
    }
    return input
  })

  return {
    form: {
      pools: draft.pools.map((p) => ({ ...p, name: p.name.trim() })),
      openfrom: new Date(draft.openfrom).toISOString(),
      openuntil: new Date(draft.openuntil).toISOString(),
      inputs,
      confirmedMessage: draft.confirmedMessage,
      confirmedLink: draft.confirmedLink,
    },
  }
}

type Props = {
  value: FormDraft
  onChange: (draft: FormDraft) => void
}

const smallestFreeId = (fields: FieldDraft[]) => {
  const used = new Set(fields.map((f) => Number(f.id)))
  let next = 1
  while (used.has(next)) next += 1
  return next
}

// Open times, pools and the message for participants: label and control pairs
// for a two-column grid (grid-cols-input)
export const SignupFormSettings = ({
  value,
  onChange,
  eventStart,
}: Props & {
  // Start of the event the sign-up is for; time picker presets are relative to it
  eventStart: Moment | null
}) => {
  const set = (changes: Partial<FormDraft>) => onChange({ ...value, ...changes })
  const { pools } = value
  const updatePool = (id: number, changes: Partial<SignupPool>) =>
    set({ pools: pools.map((p) => (p.id === id ? { ...p, ...changes } : p)) })
  const addPool = () =>
    set({ pools: [...pools, { id: Math.max(0, ...pools.map((p) => p.id)) + 1, name: '', size: 0 }] })
  const removePool = (id: number) => set({ pools: pools.filter((p) => p.id !== id) })

  return (
    <>
      <label className="flex items-center">
        Sign-up open from
        <span className="text-red">*</span>
      </label>
      <SignupTimePicker
        value={value.openfrom}
        onChange={(openfrom) => set({ openfrom })}
        eventStart={eventStart}
        commonMargins="mt-2 mb-8 md:m-4"
      />
      <label className="flex items-center">
        Sign-up open until
        <span className="text-red">*</span>
      </label>
      <SignupTimePicker
        value={value.openuntil}
        onChange={(openuntil) => set({ openuntil })}
        eventStart={eventStart}
        commonMargins="mt-2 mb-8 md:m-4"
      />
      <div className="flex flex-col justify-center">
        <div>
          Participant pools
          <span className="text-red">*</span>
        </div>
        <div className="text-sm text-lightgray">
          With more than one pool, participants choose which pool to sign up to.
        </div>
      </div>
      <div className="mt-2 mb-8 md:m-4 flex flex-col gap-2">
        {pools.map((p) => (
          <div className="flex flex-col gap-1" key={p.id}>
            <div className="flex items-center gap-2">
              <input
                value={p.name}
                onChange={(e) => updatePool(p.id, { name: e.target.value })}
                placeholder="Pool name"
                className="p-2 rounded-md bg-white text-black flex-1 min-w-0"
                required
              />
              <input
                value={p.size}
                onChange={(e) => updatePool(p.id, { size: parseInt(e.target.value, 10) || 0 })}
                type="number"
                min={0}
                step={1}
                title="Size"
                aria-label="Size"
                className="p-2 rounded-md bg-white text-black w-20"
                required
              />
              <button
                type="button"
                className={p.private ? 'text-red' : 'text-lightgray hover:text-red'}
                onClick={() => updatePool(p.id, { private: !p.private, password: p.password ?? '' })}
                title={p.private ? 'Private: needs a password' : 'Public: anyone can join'}
                aria-label={p.private ? 'Make pool public' : 'Make pool private'}
              >
                {p.private ? <FaLock size={14} /> : <FaLockOpen size={14} />}
              </button>
              {pools.length > 1 && (
                <button
                  type="button"
                  className="text-lightgray hover:text-red"
                  onClick={() => removePool(p.id)}
                  aria-label="Remove pool"
                >
                  <FaTrash size={14} />
                </button>
              )}
            </div>
            {p.private && (
              <input
                value={p.password ?? ''}
                onChange={(e) => updatePool(p.id, { password: e.target.value })}
                placeholder={`Password for ${p.name || 'this pool'}`}
                className="p-2 rounded-md bg-white text-black text-base"
                required
              />
            )}
          </div>
        ))}
        {hasDuplicatePoolNames(value) && (
          <div className="text-red text-sm">Pool names must be unique.</div>
        )}
        <div className="text-sm">
          <button type="button" className="link" onClick={addPool}>
            + Add pool
          </button>
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <div>For participants</div>
        <div className="text-sm text-lightgray">
          Shown only to those who got a place, not to those on a reserve list.
        </div>
      </div>
      <div className="mt-2 mb-8 md:m-4 flex flex-col gap-2">
        <input
          value={value.confirmedMessage}
          onChange={(e) => set({ confirmedMessage: e.target.value })}
          placeholder="Message, e.g. Join the event Telegram group!"
          aria-label="Message for participants"
          className="p-2 rounded-md bg-white text-black text-base"
        />
        <input
          value={value.confirmedLink}
          onChange={(e) => set({ confirmedLink: e.target.value })}
          type="url"
          placeholder="Link, e.g. https://t.me/+abc123"
          aria-label="Link for participants"
          className="p-2 rounded-md bg-white text-black text-base"
        />
      </div>
    </>
  )
}

// The sign-up fields, with buttons to add more
export const SignupFieldsEditor = ({ value, onChange }: Props) => {
  const { fields } = value
  const setFields = (next: FieldDraft[]) => onChange({ ...value, fields: next })
  const duplicates = duplicateFieldIds(value)

  const add = (type: EditableInputType) =>
    setFields([
      ...fields,
      {
        key: nextKey++,
        id: String(smallestFreeId(fields)),
        type,
        title: '',
        description: '',
        options: '',
        required: false,
        public: false,
        multi: false,
      },
    ])

  const move = (index: number, by: number) => {
    const next = [...fields]
    const [field] = next.splice(index, 1)
    next.splice(index + by, 0, field)
    setFields(next)
  }

  return (
    <div className="flex flex-col">
      <h3 className="text-center mt-4 mb-5">Sign-up Fields</h3>
      <h5 className="text-center text-lightgray">
        Don&apos;t edit field IDs or select options after signups have started.
      </h5>
      {fields.map((field, i) => (
        <EditableInput
          key={field.key}
          field={field}
          onChange={(changes) =>
            setFields(fields.map((f) => (f.key === field.key ? { ...f, ...changes } : f)))
          }
          handleUp={() => move(i, -1)}
          handleDown={() => move(i, 1)}
          handleDelete={() => setFields(fields.filter((f) => f.key !== field.key))}
          index={i}
          lastIndex={fields.length - 1}
          duplicateId={duplicates.has(Number(field.id))}
        />
      ))}
      <div className="w-full flex flex-wrap justify-center gap-4 p-4">
        <button type="button" className="borderbutton" onClick={() => add('text')}>
          Add text input
        </button>
        <button type="button" className="borderbutton" onClick={() => add('select')}>
          Add select input
        </button>
        <button type="button" className="borderbutton" onClick={() => add('info')}>
          Add info box
        </button>
      </div>
    </div>
  )
}
