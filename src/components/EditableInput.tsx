/* eslint-disable jsx-a11y/label-has-associated-control */
import { FaArrowDown, FaArrowUp, FaTrash } from 'react-icons/fa'
import { UseFormRegister } from 'react-hook-form'
import { EditableInputObj } from '../types/types'
/* eslint-disable react/jsx-props-no-spreading */

type EditableInputProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>
  thisObj: EditableInputObj
  handleUp: (thisObj: EditableInputObj) => void
  handleDown: (thisObj: EditableInputObj) => void
  handleDelete: (number: number) => void
  index: number
  lastIndex: number
}

const EditableInput = ({
  register,
  thisObj,
  handleUp,
  handleDelete,
  handleDown,
  index,
  lastIndex,
}: EditableInputProps) => {
  const { number, type } = thisObj
  const className = 'p-2 border-black border-solid border-b-2'
  return (
    <div className="bg-white p-4 m-4 rounded-lg flex">
      <div className="flex flex-col gap-2 flex-1 ">
        <div className="text-lightGray">
          {type === 'text' && 'Text'}
          {type === 'select' && 'Dropdown'}
          {type === 'info' && 'Infobox'}
        </div>
        <input
          {...register(`${number}-title`)}
          placeholder="Title"
          className={className}
          required
        />
        {type !== 'select' && (
          <input
            {...register(`${number}-description`)}
            placeholder={type === 'info' ? 'description' : 'placeholder'}
            className={className}
          />
        )}
        {type === 'select' && (
          <input
            {...register(`${number}-options`)}
            placeholder="Option1, Option2, Option3"
            className={className}
            required
          />
        )}
        {type !== 'info' && (
          <div className="flex gap-4">
            <label className="text-black">
              Required
              <input {...register(`${number}-required`)} type="checkbox" className="ml-1" />
            </label>
            <label className="text-black">
              Public
              <input {...register(`${number}-public`)} type="checkbox" className="ml-1" />
            </label>
          </div>
        )}
        <input {...register(`${number}-type`)} type="hidden" value={type} />
      </div>
      <div className="text-lightGray flex flex-col justify-between pl-4">
        {index === 0 ? (
          <div />
        ) : (
          <button type="button" onClick={() => handleUp(thisObj)}>
            <FaArrowUp size={16} />
          </button>
        )}
        <button type="button" onClick={() => handleDelete(number)}>
          <FaTrash size={16} />
        </button>
        {index === lastIndex ? (
          <div />
        ) : (
          <button type="button" onClick={() => handleDown(thisObj)}>
            <FaArrowDown size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

export default EditableInput
