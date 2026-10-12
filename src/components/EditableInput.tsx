import { FaArrowDown, FaArrowUp, FaPlus, FaTrash } from 'react-icons/fa'
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

const className = 'p-2 rounded-md bg-white text-black w-full border border-gray-300'

const Checkbox = ({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <label className="flex items-center gap-1 text-sm">
    <input checked={checked} onChange={(e) => onChange(e.target.checked)} type="checkbox" />
    {label}
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
  const iconButton = 'p-1 text-lightgray hover:text-red disabled:invisible'
  return (
    <div
      className={`bg-white text-black border rounded-md p-3 flex flex-col gap-2 ${isSubField ? 'border-gray-200' : 'border-gray-300'}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-lightgray flex-1">{TYPE_NAMES[type]}</span>
        {!isSubField && (
          <label
            className="flex items-center gap-1 text-sm text-lightgray"
            title="Answers are stored under this ID. Don't change it after people have signed up."
          >
            ID
            <input
              value={field.id}
              onChange={(e) => onChange({ id: e.target.value })}
              type="number"
              min={1}
              step={1}
              className={`${className} !w-16 !p-1 ${duplicateId ? '!border-red' : ''}`}
            />
          </label>
        )}
        <button
          type="button"
          onClick={handleUp}
          disabled={index === 0}
          className={iconButton}
          title="Move up"
          aria-label="Move up"
        >
          <FaArrowUp size={14} />
        </button>
        <button
          type="button"
          onClick={handleDown}
          disabled={index === lastIndex}
          className={iconButton}
          title="Move down"
          aria-label="Move down"
        >
          <FaArrowDown size={14} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className={iconButton}
          title="Delete field"
          aria-label="Delete field"
        >
          <FaTrash size={14} />
        </button>
      </div>
      {duplicateId && <div className="text-red text-sm">Another field has this ID.</div>}
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
          <div className="text-sm flex flex-wrap items-center gap-2">
            <input
              value={field.itemLabel}
              onChange={(e) => onChange({ itemLabel: e.target.value })}
              placeholder="Item name, e.g. Player"
              className={`${className} !w-44`}
            />
            <span>at least</span>
            <input
              value={field.min}
              onChange={(e) => onChange({ min: e.target.value })}
              type="number"
              min={0}
              max={MAX_GROUP_ITEMS}
              className={`${className} !w-16`}
            />
            <span>at most</span>
            <input
              value={field.max}
              onChange={(e) => onChange({ max: e.target.value })}
              type="number"
              min={1}
              max={MAX_GROUP_ITEMS}
              placeholder={String(MAX_GROUP_ITEMS)}
              className={`${className} !w-16`}
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
  )
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
    <div className="flex flex-col gap-3">
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
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {types
          .filter((type) => type !== 'image' || !hasImage)
          .map((type) => (
            <button
              key={type}
              type="button"
              className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-300 bg-white text-black hover:border-red"
              onClick={() => add(type)}
            >
              <FaPlus size={10} className="text-lightgray" />
              {TYPE_NAMES[type]}
            </button>
          ))}
      </div>
    </div>
  )
}

export default EditableInput
