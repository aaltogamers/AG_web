import { FaArrowDown, FaArrowUp, FaTrash } from 'react-icons/fa'
import type { FieldDraft } from './SignupFormEditor'

type EditableInputProps = {
  field: FieldDraft
  onChange: (changes: Partial<FieldDraft>) => void
  handleUp: () => void
  handleDown: () => void
  handleDelete: () => void
  index: number
  lastIndex: number
  duplicateId?: boolean
}

const EditableInput = ({
  field,
  onChange,
  handleUp,
  handleDelete,
  handleDown,
  index,
  lastIndex,
  duplicateId,
}: EditableInputProps) => {
  const { type } = field
  const className = 'p-2 border-black border-solid border-b-2'
  return (
    <div className="bg-white p-4 m-4 rounded-lg flex">
      <div className="flex flex-col gap-2 flex-1 ">
        <div className="text-lightgray">
          {type === 'text' && 'Text'}
          {type === 'select' && 'Dropdown'}
          {type === 'info' && 'Infobox'}
        </div>
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
        <input
          value={field.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title"
          className={className}
          required
        />
        {type !== 'select' && (
          <input
            value={field.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={type === 'info' ? 'Description' : 'Placeholder'}
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
        {type !== 'info' && (
          <div className="flex gap-4">
            <label className="text-black">
              Required
              <input
                checked={field.required}
                onChange={(e) => onChange({ required: e.target.checked })}
                type="checkbox"
                className="ml-1"
              />
            </label>
            <label className="text-black">
              Public
              <input
                checked={field.public}
                onChange={(e) => onChange({ public: e.target.checked })}
                type="checkbox"
                className="ml-1"
              />
            </label>
            {type === 'select' && (
              <label className="text-black">
                Multiple select
                <input
                  checked={field.multi}
                  onChange={(e) => onChange({ multi: e.target.checked })}
                  type="checkbox"
                  className="ml-1"
                />
              </label>
            )}
          </div>
        )}
      </div>
      <div className="text-lightgray flex flex-col justify-between pl-4">
        {index === 0 ? (
          <div />
        ) : (
          <button type="button" onClick={handleUp}>
            <FaArrowUp size={16} />
          </button>
        )}
        <button type="button" onClick={handleDelete}>
          <FaTrash size={16} />
        </button>
        {index === lastIndex ? (
          <div />
        ) : (
          <button type="button" onClick={handleDown}>
            <FaArrowDown size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

export default EditableInput
