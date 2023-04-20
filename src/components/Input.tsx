/* eslint-disable react/jsx-props-no-spreading */
import { HTMLInputTypeAttribute } from 'react'
import { UseFormRegister } from 'react-hook-form'

type Props = {
  name: string
  displayName: string
  type?: HTMLInputTypeAttribute
  placeHolder?: string
  defaultValue?: string
  required?: boolean
  isPublic?: boolean
  options?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>
  onChange?: (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void
}

const TextInput = ({
  name,
  displayName,
  type,
  placeHolder,
  defaultValue,
  register,
  required,
  options,
  onChange,
  isPublic,
}: Props) => {
  const lowerCaseName = name.toLowerCase()
  const className = 'm-4 p-2 rounded-md'
  return (
    <>
      <label className="flex items-center" htmlFor={lowerCaseName}>
        {displayName + (isPublic ? ' (public)' : '')}
        <span className="text-red">{required && '*'}</span>
      </label>
      {options && options.length > 0 ? (
        <select {...register(name)} className={className} id={lowerCaseName} onChange={onChange}>
          {options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          defaultValue={defaultValue}
          placeholder={placeHolder}
          type={type}
          step={1}
          min={0}
          required={required}
          {...register(name)}
          className={className}
          id={lowerCaseName}
          onChange={onChange}
        />
      )}
    </>
  )
}

export default TextInput
