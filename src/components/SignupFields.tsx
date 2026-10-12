// The fields of a sign-up form as the participant fills them in, used by SignupDialog
import { useRef, useState } from 'react'
import { FaChevronDown, FaChevronUp, FaImage, FaPlus, FaTrash } from 'react-icons/fa'
import Select from 'react-select'
import type { DataValue, GroupItem, SignupInput } from '../types/types'
import {
  AnswerErrors,
  groupAddLabel,
  groupItemLabel,
  groupItems,
  groupMax,
  groupMin,
  imageUrl,
  MAX_TEXT_LENGTH,
  MAX_TEXTAREA_LENGTH,
  subFieldPath,
} from '../utils/signupAnswers'
import Markdown from './Markdown'

// Single choice with at most this many options is shown as radio buttons
const MAX_RADIO_OPTIONS = 6
// Larger images are scaled down in the browser before upload
const MAX_IMAGE_SIDE = 1024
const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024

export const fieldElementId = (path: string) => `signup-field-${path.replace(/\./g, '-')}`

const inputClass = 'p-2 rounded-md w-full bg-white text-black'

type FieldProps = {
  input: SignupInput
  value: DataValue | undefined
  onChange: (value: DataValue) => void
  // Errors to show, by field path
  errors: AnswerErrors
  path: string
}

const Label = ({ input, htmlFor }: { input: SignupInput; htmlFor?: string }) => (
  <div className="flex flex-col mb-2">
    <label htmlFor={htmlFor}>
      {input.title}
      {input.required ? (
        <span className="text-red">*</span>
      ) : (
        <span className="text-sm text-lightgray"> (optional)</span>
      )}
      {input.public && <span className="text-sm text-lightgray"> (public)</span>}
    </label>
    {input.description && (
      <Markdown compact className="text-base text-lightgray">
        {input.description}
      </Markdown>
    )}
  </div>
)

const ErrorText = ({ message }: { message?: string }) =>
  message ? (
    <div className="text-red text-base mt-1" data-signup-error>
      {message}
    </div>
  ) : null

const TextField = ({ input, value, onChange, path }: FieldProps) => {
  const id = fieldElementId(path)
  const common = {
    id,
    value: typeof value === 'string' ? value : '',
    placeholder: input.placeholder,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    className: inputClass,
  }
  return input.type === 'textarea' ? (
    <textarea {...common} rows={4} maxLength={MAX_TEXTAREA_LENGTH} />
  ) : (
    <input {...common} type="text" maxLength={MAX_TEXT_LENGTH} />
  )
}

const selectTheme = <T,>(theme: T & { colors: object }) => ({
  ...theme,
  colors: { ...theme.colors, primary25: 'lightgray', primary: 'red' },
})

const SelectField = ({ input, value, onChange, path }: FieldProps) => {
  const id = fieldElementId(path)
  const options = input.options ?? []
  const selected: string[] = Array.isArray(value)
    ? (value as string[])
    : typeof value === 'string' && value
      ? [value]
      : []

  if (options.length <= MAX_RADIO_OPTIONS) {
    const toggle = (option: string) => {
      if (!input.multi) return onChange(option)
      onChange(
        selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]
      )
    }
    return (
      <div className="flex flex-col gap-1" role={input.multi ? 'group' : 'radiogroup'} id={id}>
        {options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-3 cursor-pointer py-1 hover:text-white"
          >
            <input
              type={input.multi ? 'checkbox' : 'radio'}
              name={id}
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
              className="accent-red w-4 h-4 shrink-0"
            />
            {option}
          </label>
        ))}
        {!input.multi && !input.required && selected.length > 0 && (
          <button type="button" className="link text-base self-start" onClick={() => onChange('')}>
            Clear choice
          </button>
        )}
      </div>
    )
  }

  const selectOptions = options.map((o) => ({ value: o, label: o }))
  return (
    <Select
      inputId={id}
      isMulti={!!input.multi}
      isClearable={!input.required || !!input.multi}
      placeholder="Choose…"
      value={selectOptions.filter((o) => selected.includes(o.value))}
      onChange={(val) => {
        if (Array.isArray(val)) onChange(val.map((o) => o.value))
        else onChange((val as { value: string } | null)?.value ?? '')
      }}
      options={selectOptions}
      className="text-black"
      theme={selectTheme}
    />
  )
}

// Scales the image down and returns it as a data URL
const readImage = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('Choose a JPG, PNG or WebP image')
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error('The image is larger than 20 MB')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("Couldn't read the image. Try a JPG or PNG.")
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const webp = canvas.toDataURL('image/webp', 0.9)
  // Browsers that can't make WebP give a PNG
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}

const ImageField = ({ value, onChange, path }: FieldProps) => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const url = imageUrl(value)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setIsReading(true)
    try {
      onChange(await readImage(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsReading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-24 h-24 shrink-0 border-2 border-dashed border-gray-600 hover:border-red flex items-center justify-center bg-black"
        aria-label={url ? 'Change image' : 'Choose image'}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-w-full max-h-full object-contain" />
        ) : (
          <FaImage size={28} className="text-lightgray" />
        )}
      </button>
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          className="borderbutton !text-base !py-1 !px-4"
          onClick={() => fileRef.current?.click()}
          disabled={isReading}
        >
          {isReading ? 'Reading…' : url ? 'Change image' : 'Choose image'}
        </button>
        {url && (
          <button type="button" className="link text-base" onClick={() => onChange('')}>
            Remove
          </button>
        )}
        <span className="text-sm text-lightgray">JPG, PNG or WebP</span>
        <ErrorText message={error ?? undefined} />
      </div>
      <input
        ref={fileRef}
        id={fieldElementId(path)}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  )
}

const GroupField = ({ input, value, onChange, errors }: FieldProps) => {
  const items = groupItems(value)
  const subs = input.fields ?? []
  const min = groupMin(input)
  const max = groupMax(input)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const setItem = (index: number, item: GroupItem) =>
    onChange(items.map((old, i) => (i === index ? item : old)))
  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
    setCollapsed(new Set())
  }
  const toggle = (index: number) => {
    const next = new Set(collapsed)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setCollapsed(next)
  }
  const hasErrors = (index: number) => subs.some((f) => errors[subFieldPath(input.id, index, f.id)])
  const summary = (item: GroupItem) =>
    subs
      .slice(0, 2)
      .map((f) => {
        const v = item[f.id]
        return Array.isArray(v) ? v.join(', ') : v
      })
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        // Cards with errors are always open
        const isOpen = !collapsed.has(index) || hasErrors(index)
        return (
          <div
            key={index}
            className={`bg-black border-l-4 ${hasErrors(index) ? 'border-red' : 'border-gray-600'}`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => toggle(index)}
                className="flex-1 min-w-0 flex items-center gap-3 text-left"
                aria-expanded={isOpen}
              >
                {isOpen ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                <span className="font-bold shrink-0">{groupItemLabel(input, index)}</span>
                {!isOpen && (
                  <span className="text-lightgray truncate">
                    {summary(item) || 'Not filled in'}
                  </span>
                )}
              </button>
              {index >= min && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-lightgray hover:text-red p-1"
                  aria-label={`Remove ${groupItemLabel(input, index)}`}
                >
                  <FaTrash size={14} />
                </button>
              )}
            </div>
            {isOpen && (
              <div className="px-4 pb-1">
                {subs.map((sub) => (
                  <SignupField
                    key={sub.id}
                    input={sub}
                    value={item[sub.id]}
                    onChange={(v) => setItem(index, { ...item, [sub.id]: v as string | string[] })}
                    errors={errors}
                    path={subFieldPath(input.id, index, sub.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
      {items.length < max && (
        <button
          type="button"
          onClick={() => onChange([...items, {}])}
          className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-600 hover:border-red py-3"
        >
          <FaPlus size={12} />
          Add {groupAddLabel(input, items.length).toLowerCase()}
        </button>
      )}
    </div>
  )
}

export const SignupField = (props: FieldProps) => {
  const { input, path, errors } = props
  const id = fieldElementId(path)
  if (input.type === 'info') {
    return (
      <div className="mb-6">
        {input.title && <h4 className="mb-1">{input.title}</h4>}
        {input.description && (
          <Markdown compact className="text-lg text-lightgray">
            {input.description}
          </Markdown>
        )}
      </div>
    )
  }
  return (
    <div className={input.type === 'group' ? 'mb-8' : 'mb-6'} data-field-path={path}>
      {input.type === 'group' ? (
        <div className="flex flex-col mb-3">
          <h4>{input.title}</h4>
          {input.description && (
            <Markdown compact className="text-base text-lightgray">
              {input.description}
            </Markdown>
          )}
        </div>
      ) : (
        <Label input={input} htmlFor={input.type === 'image' ? undefined : id} />
      )}
      {(input.type === 'text' || input.type === 'textarea') && <TextField {...props} />}
      {input.type === 'select' && <SelectField {...props} />}
      {input.type === 'image' && <ImageField {...props} />}
      {input.type === 'group' && <GroupField {...props} />}
      <ErrorText message={errors[path]} />
    </div>
  )
}
