/* eslint-disable @typescript-eslint/no-explicit-any */

import { HTMLInputTypeAttribute } from 'react'
import { UseFormRegister, Controller, Control } from 'react-hook-form'
import Select from 'react-select'
import slug from 'slug'

type Props = {
  name: string
  displayName: string
  type?: HTMLInputTypeAttribute
  placeHolder?: string
  defaultValue?: string
  required?: boolean
  isPublic?: boolean
  options?: string[]

  register: UseFormRegister<any>
  onChangeDo?: (value: any) => void
  control: Control<any, any>
  isMulti?: boolean
}

type OptionWithLabel = {
  value: string
  label: string
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
  onChangeDo,
  isPublic,
  control,
  isMulti,
}: Props) => {
  const inputSlug = slug(name)
  const commonMargins = 'mt-2 mb-8 md:m-4'
  const optionsWithLabel: OptionWithLabel[] = options?.map((o) => ({ value: o, label: o })) || []

  return (
    <>
      <label className="flex items-center" htmlFor={inputSlug}>
        {displayName + (isPublic ? ' (public)' : '')}
        <span className="text-red">{required && '*'}</span>
      </label>
      {options && options.length > 0 ? (
        <Controller
          control={control}
          defaultValue={isMulti ? [] : [options[0]]}
          name={inputSlug}
          render={({ field: { onChange, value, ref } }) => (
            <Select
              ref={ref}
              required={required}
              value={optionsWithLabel.filter((c) => value.includes(c.value))}
              onChange={(val: any) => {
                const actualValue = isMulti
                  ? (val as OptionWithLabel[]).map((c) => c.value)
                  : (val as OptionWithLabel).value
                onChange(actualValue)
                if (onChangeDo) {
                  onChangeDo(actualValue)
                }
              }}
              options={optionsWithLabel}
              isMulti={isMulti}
              className={`${commonMargins} text-black w-full`}
              theme={(theme: any) => ({
                ...theme,
                colors: {
                  ...theme.colors,
                  primary25: 'lightgray',
                  primary: 'red',
                },
              })}
            />
          )}
        />
      ) : (
        <input
          defaultValue={defaultValue}
          placeholder={placeHolder}
          type={type}
          step={1}
          min={0}
          required={required}
          {...register(inputSlug)}
          className={`p-2 rounded-md ${commonMargins} w-full bg-white`}
          id={inputSlug}
          onChange={(e) => {
            if (onChangeDo) {
              onChangeDo(e?.target.value)
            }
          }}
        />
      )}
    </>
  )
}

export default TextInput
