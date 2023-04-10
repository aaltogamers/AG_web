/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/jsx-props-no-spreading */
import { HTMLInputTypeAttribute } from 'react'
import { UseFormRegister } from 'react-hook-form'

type Props = {
  name: string
  displayName: string
  type?: HTMLInputTypeAttribute
  placeHolder?: string
  defaultValue?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>
}

const TextInput = ({ name, displayName, type, placeHolder, defaultValue, register }: Props) => {
  return (
    <>
      <label className="flex items-center">{displayName}</label>
      <input
        defaultValue={defaultValue}
        placeholder={placeHolder}
        type={type}
        step={1}
        min={0}
        {...register(name)}
        className=" m-4 p-2 rounded-md"
      />
    </>
  )
}

export default TextInput
