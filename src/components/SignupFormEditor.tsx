// Controlled sign-up form editor, used by the sign-up editor (SignupEditor.tsx). Turn the FormDraft into
// SignUpData with draftToForm.
import moment, { Moment } from 'moment'
import { FaLock, FaLockOpen, FaTrash } from 'react-icons/fa'
import type { EditableInputType, SignupInput, SignupPool, SignUpData } from '../types/types'
import { defaultPools } from '../utils/signupPools'
import { inputsError } from '../utils/signupAnswers'
import { FieldList, newFieldKey } from './EditableInput'
import SignupTimePicker from './SignupTimePicker'

// Field values as typed: the id and the select options are kept as text
export type FieldDraft = {
  // React key, stable while the field moves
  key: number
  id: string
  type: EditableInputType
  title: string
  description: string
  placeholder: string
  options: string
  required: boolean
  public: boolean
  multi: boolean
  // Groups: how many items (as typed), their labels and sub-fields
  min: string
  max: string
  itemLabel: string
  extraLabel: string
  subFields: FieldDraft[]
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

export const emptyFormDraft = (): FormDraft => ({
  openfrom: '',
  openuntil: '',
  pools: defaultPools(),
  fields: [],
  confirmedMessage: '',
  confirmedLink: '',
})

const inputToDraft = (input: SignupInput): FieldDraft => ({
  key: newFieldKey(),
  id: String(input.id ?? ''),
  type: input.type,
  title: input.title ?? '',
  description: input.description ?? '',
  placeholder: input.placeholder ?? '',
  options: (input.options ?? []).join(', '),
  required: !!input.required,
  public: !!input.public,
  multi: !!input.multi,
  min: input.min === undefined ? '' : String(input.min),
  max: input.max === undefined ? '' : String(input.max),
  itemLabel: input.itemLabel ?? '',
  extraLabel: input.extraLabel ?? '',
  subFields: (input.fields ?? []).map(inputToDraft),
})

export const formToDraft = (form: Omit<SignUpData, 'key'>): FormDraft => ({
  openfrom: form.openfrom ? moment(form.openfrom).format(LOCAL_FORMAT) : '',
  openuntil: form.openuntil ? moment(form.openuntil).format(LOCAL_FORMAT) : '',
  pools: form.pools?.length ? form.pools : defaultPools(),
  fields: (form.inputs ?? []).map(inputToDraft),
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

const optionalInt = (value: string) => {
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

// Explicit ids are kept; fields without one get the smallest free id
const draftToInputs = (fields: FieldDraft[]): SignupInput[] => {
  const used = new Set(fields.map((f) => Number(f.id)).filter((n) => Number.isFinite(n) && n > 0))
  let nextId = 1
  return fields.map((f, i) => {
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
      public: f.type !== 'group' && f.type !== 'info' && f.public,
      required: f.type !== 'group' && f.type !== 'info' && f.required,
    }
    if (f.description) input.description = f.description
    if ((f.type === 'text' || f.type === 'textarea') && f.placeholder) {
      input.placeholder = f.placeholder
    }
    if (f.type === 'select') {
      input.options = f.options
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
      input.multi = f.multi
    }
    if (f.type === 'group') {
      input.fields = draftToInputs(f.subFields)
      const min = optionalInt(f.min)
      const max = optionalInt(f.max)
      if (min !== undefined) input.min = min
      if (max !== undefined) input.max = max
      if (f.itemLabel.trim()) input.itemLabel = f.itemLabel.trim()
      if (f.extraLabel.trim()) input.extraLabel = f.extraLabel.trim()
    }
    return input
  })
}

// The fields as participants see them, e.g. for a preview of an unsaved form
export const draftInputs = (draft: FormDraft) => draftToInputs(draft.fields)

// The form to save, or what's wrong with it
export const draftToForm = (
  draft: FormDraft
): { form: Omit<SignUpData, 'key'> } | { error: string } => {
  if (duplicateFieldIds(draft).size) return { error: 'field IDs must be unique.' }
  if (hasDuplicatePoolNames(draft)) return { error: 'pool names must be unique.' }
  if (!draft.openfrom || !draft.openuntil) {
    return { error: 'choose when sign-up opens and closes.' }
  }
  const inputs = draftToInputs(draft.fields)
  const error = inputsError(inputs)
  if (error) return { error: `${error}.` }

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

export const inputClass = 'p-2 rounded-md bg-white text-black w-full border border-gray-300'

export const Section = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) => (
  <section className="flex flex-col gap-3">
    <div>
      <h3 className="text-xl font-normal">{title}</h3>
      {description && <div className="text-sm text-lightgray">{description}</div>}
    </div>
    {children}
  </section>
)

// Open times, pools and the message for participants
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
      <Section title="Sign-up time">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm">
              Opens<span className="text-red">*</span>
            </span>
            <SignupTimePicker
              value={value.openfrom}
              onChange={(openfrom) => set({ openfrom })}
              eventStart={eventStart}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm">
              Closes<span className="text-red">*</span>
            </span>
            <SignupTimePicker
              value={value.openuntil}
              onChange={(openuntil) => set({ openuntil })}
              eventStart={eventStart}
            />
          </div>
        </div>
      </Section>
      <Section
        title="Pools"
        description="With more than one pool, participants choose which pool to sign up to."
      >
        {pools.map((p) => (
          <div className="flex flex-col gap-1" key={p.id}>
            <div className="flex items-center gap-2">
              <input
                value={p.name}
                onChange={(e) => updatePool(p.id, { name: e.target.value })}
                placeholder="Pool name"
                className={`${inputClass} flex-1 min-w-0`}
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
                className={`${inputClass} !w-20`}
                required
              />
              <button
                type="button"
                className={`p-1 ${p.private ? 'text-red' : 'text-lightgray hover:text-red'}`}
                onClick={() => updatePool(p.id, { private: !p.private, password: p.password ?? '' })}
                title={p.private ? 'Private: needs a password' : 'Public: anyone can join'}
                aria-label={p.private ? 'Make pool public' : 'Make pool private'}
              >
                {p.private ? <FaLock size={14} /> : <FaLockOpen size={14} />}
              </button>
              {pools.length > 1 && (
                <button
                  type="button"
                  className="p-1 text-lightgray hover:text-red"
                  onClick={() => removePool(p.id)}
                  title="Remove pool"
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
                className={inputClass}
                required
              />
            )}
          </div>
        ))}
        {hasDuplicatePoolNames(value) && (
          <div className="text-red text-sm">Pool names must be unique.</div>
        )}
        <button type="button" className="link self-start text-sm" onClick={addPool}>
          + Add pool
        </button>
      </Section>
      <Section
        title="For participants"
        description="Shown only to those who got a place, not to those on a reserve list."
      >
        <input
          value={value.confirmedMessage}
          onChange={(e) => set({ confirmedMessage: e.target.value })}
          placeholder="Message, e.g. Join the event Telegram group!"
          aria-label="Message for participants"
          className={inputClass}
        />
        <input
          value={value.confirmedLink}
          onChange={(e) => set({ confirmedLink: e.target.value })}
          type="url"
          placeholder="Link, e.g. https://t.me/+abc123"
          aria-label="Link for participants"
          className={inputClass}
        />
      </Section>
    </>
  )
}

// The sign-up fields, with buttons to add more
export const SignupFieldsEditor = ({
  value,
  onChange,
  hasSignups,
}: Props & {
  // Field IDs and select options shouldn't change once people have signed up
  hasSignups: boolean
}) => (
  <Section
    title="Fields"
    description={
      hasSignups
        ? "People have signed up, so don't change field IDs or select options."
        : undefined
    }
  >
    <FieldList
      fields={value.fields}
      onChange={(fields) => onChange({ ...value, fields })}
      duplicateIds={duplicateFieldIds(value)}
    />
  </Section>
)
