import { FaArrowDown, FaArrowUp, FaTrash } from 'react-icons/fa'
import type { EditableInputType } from '../types/types'
import { GROUP_SUB_FIELD_TYPES, MAX_GROUP_ITEMS } from '../utils/signupAnswers'
import type { FieldDraft } from './SignupFormEditor'

const TYPE_NAMES: Record<EditableInputType, string> = {
  text: 'Text',
  textarea: 'Long text',
  select: 'Dropdown',
  info: 'Infobox',
  image: 'Image upload',
  group: 'Group (e.g. players)',
}

let nextKey = 1
// React key of a field draft, stable while the field moves
export const newFieldKey = () => nextKey++

const smallestFreeId = (fields: FieldDraft[]) => {
  const used = new Set(fields.map((f) => Number(f.id)))
  let next = 1
  while (used.has(next)) next += 1
  return next
}

const emptyFieldDraft = (type: EditableInputType, id: number): FieldDraft => ({
  key: newFieldKey(),
  id: String(id),
  type,
  title: '',
  description: '',
  placeholder: '',
  options: '',
  required: false,
  public: false,
  multi: false,
  min: type === 'group' ? '1' : '',
  max: '',
  itemLabel: '',
  extraLabel: '',
  subFields: [],
})

type EditableInputProps = {
  field: FieldDraft
  onChange: (changes: Partial<FieldDraft>) => void
  handleUp: () => void
  handleDown: () => void
  handleDelete: () => void
  index: number
  lastIndex: number
  duplicateId?: boolean
  // Fields inside a group get their ids automatically
  isSubField?: boolean
}

const className = 'p-2 border-black border-solid border-b-2'

const Checkbox = ({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <label className="text-black">
    {label}
    <input
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      type="checkbox"
      className="ml-1"
    />
  </label>
)

const EditableInput = ({
  field,
  onChange,
  handleUp,
  handleDelete,
  handleDown,
  index,
  lastIndex,
  duplicateId,
  isSubField,
}: EditableInputProps) => {
  const { type } = field
  const hasAnswer = type !== 'info' && type !== 'group'
  return (
    <div
      className={`bg-white p-4 rounded-lg flex ${isSubField ? 'my-2 border border-lightgray' : 'm-4'}`}
    >
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="text-lightgray">{TYPE_NAMES[type]}</div>
        {!isSubField && (
          <label className="text-black text-sm flex items-center gap-2">
            <span className="w-16">Field ID</span>
            <input
              value={field.id}
              onChange={(e) => onChange({ id: e.target.value })}
              type="number"
              min={1}
              step={1}
              className={`${className} w-24 ${duplicateId ? 'border-red border-2' : ''}`}
            />
            {duplicateId ? (
              <span className="text-red text-xs">Duplicate ID — must be unique.</span>
            ) : (
              <span className="text-lightgray text-xs">
                Auto-assigned. Answers are stored under this ID — don&apos;t change after signups
                have started.
              </span>
            )}
          </label>
        )}
        <input
          value={field.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={type === 'info' ? 'Title (optional)' : 'Title'}
          className={className}
          required={type !== 'info'}
        />
        {type === 'info' ? (
          <textarea
            value={field.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Text (Markdown, e.g. [link text](https://…))"
            className={className}
            rows={3}
          />
        ) : (
          <input
            value={field.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Help text under the title (optional, Markdown)"
            className={className}
          />
        )}
        {(type === 'text' || type === 'textarea') && (
          <input
            value={field.placeholder}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="Placeholder (optional)"
            className={className}
          />
        )}
        {type === 'select' && (
          <input
            value={field.options}
            onChange={(e) => onChange({ options: e.target.value })}
            placeholder="Option1, Option2, Option3"
            className={className}
            required
          />
        )}
        {hasAnswer && (
          <div className="flex flex-wrap gap-4">
            <Checkbox
              label="Required"
              checked={field.required}
              onChange={(required) => onChange({ required })}
            />
            <Checkbox
              label="Public"
              checked={field.public}
              onChange={(value) => onChange({ public: value })}
            />
            {type === 'select' && (
              <Checkbox
                label="Multiple select"
                checked={field.multi}
                onChange={(multi) => onChange({ multi })}
              />
            )}
          </div>
        )}
        {type === 'group' && (
          <>
            <div className="text-black text-sm flex flex-wrap items-center gap-2">
              <input
                value={field.itemLabel}
                onChange={(e) => onChange({ itemLabel: e.target.value })}
                placeholder="Item name, e.g. Player"
                className={`${className} w-44`}
              />
              <span>at least</span>
              <input
                value={field.min}
                onChange={(e) => onChange({ min: e.target.value })}
                type="number"
                min={0}
                max={MAX_GROUP_ITEMS}
                className={`${className} w-16`}
              />
              <span>at most</span>
              <input
                value={field.max}
                onChange={(e) => onChange({ max: e.target.value })}
                type="number"
                min={1}
                max={MAX_GROUP_ITEMS}
                placeholder={String(MAX_GROUP_ITEMS)}
                className={`${className} w-16`}
              />
            </div>
            <input
              value={field.extraLabel}
              onChange={(e) => onChange({ extraLabel: e.target.value })}
              placeholder="Name of items after the minimum, e.g. Substitute (optional)"
              className={className}
            />
            <div className="text-lightgray text-sm">
              Fields filled in for each item. Mark fields public to show them on the sign-up list.
            </div>
            <FieldList
              fields={field.subFields}
              onChange={(subFields) => onChange({ subFields })}
              types={GROUP_SUB_FIELD_TYPES}
              isSubField
            />
          </>
        )}
      </div>
      <div className="text-lightgray flex flex-col justify-between pl-4">
        {index === 0 ? (
          <div />
        ) : (
          <button type="button" onClick={handleUp} aria-label="Move up">
            <FaArrowUp size={16} />
          </button>
        )}
        <button type="button" onClick={handleDelete} aria-label="Delete field">
          <FaTrash size={16} />
        </button>
        {index === lastIndex ? (
          <div />
        ) : (
          <button type="button" onClick={handleDown} aria-label="Move down">
            <FaArrowDown size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

const ADD_LABELS: Record<EditableInputType, string> = {
  text: 'Add text input',
  textarea: 'Add long text input',
  select: 'Add select input',
  info: 'Add info box',
  image: 'Add image upload',
  group: 'Add group',
}

const ALL_TYPES: readonly EditableInputType[] = [
  'text',
  'textarea',
  'select',
  'image',
  'group',
  'info',
]

type FieldListProps = {
  fields: FieldDraft[]
  onChange: (fields: FieldDraft[]) => void
  // The types that can be added
  types?: readonly EditableInputType[]
  duplicateIds?: Set<number>
  isSubField?: boolean
}

// Fields of a form or a group, with buttons to add more
export const FieldList = ({
  fields,
  onChange,
  types = ALL_TYPES,
  duplicateIds,
  isSubField,
}: FieldListProps) => {
  const add = (type: EditableInputType) =>
    onChange([...fields, emptyFieldDraft(type, smallestFreeId(fields))])

  const move = (index: number, by: number) => {
    const next = [...fields]
    const [field] = next.splice(index, 1)
    next.splice(index + by, 0, field)
    onChange(next)
  }

  // A form can have only one image upload
  const hasImage = fields.some((f) => f.type === 'image')

  return (
    <>
      {fields.map((field, i) => (
        <EditableInput
          key={field.key}
          field={field}
          onChange={(changes) =>
            onChange(fields.map((f) => (f.key === field.key ? { ...f, ...changes } : f)))
          }
          handleUp={() => move(i, -1)}
          handleDown={() => move(i, 1)}
          handleDelete={() => onChange(fields.filter((f) => f.key !== field.key))}
          index={i}
          lastIndex={fields.length - 1}
          duplicateId={duplicateIds?.has(Number(field.id))}
          isSubField={isSubField}
        />
      ))}
      <div className={`w-full flex flex-wrap justify-center gap-4 ${isSubField ? 'py-2' : 'p-4'}`}>
        {types
          .filter((type) => type !== 'image' || !hasImage)
          .map((type) => (
            <button
              key={type}
              type="button"
              className={`borderbutton ${isSubField ? '!text-base !py-1 !px-3 !text-black' : ''}`}
              onClick={() => add(type)}
            >
              {ADD_LABELS[type]}
            </button>
          ))}
      </div>
    </>
  )
}

export default EditableInput
