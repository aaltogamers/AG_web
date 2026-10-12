// Sign-up answers: validation, public filtering and formatting. Shared by the sign-up
// dialog, its preview in the admin panel, the /api/signups routes and the MCP tools.
import type { DataValue, GroupItem, SignupInput, SignupRow, SignupPool } from '../types/types'
import { resolvePoolId } from './signupPools'

export type AnswerMap = Record<string, DataValue>
// Error messages keyed by field path: "<id>", or "<group id>.<index>.<sub-field id>"
export type AnswerErrors = Record<string, string>

export const MAX_TEXT_LENGTH = 200
export const MAX_TEXTAREA_LENGTH = 2000
const MAX_ANSWERS_BYTES = 100_000
export const MAX_GROUP_ITEMS = 20
// Field types that can be inside a group
export const GROUP_SUB_FIELD_TYPES = ['text', 'textarea', 'select'] as const

export const subFieldPath = (groupId: number, index: number, subId: number) =>
  `${groupId}.${index}.${subId}`

export const sortedInputs = (inputs: SignupInput[]) =>
  [...inputs].sort((a, b) => a.number - b.number)

// Fields that have answers (info boxes don't)
export const answerInputs = (inputs: SignupInput[]) =>
  sortedInputs(inputs).filter((input) => input.type !== 'info')

// Sub-fields of a group that are shown publicly
const publicSubFields = (input: SignupInput) => (input.fields ?? []).filter((f) => f.public)

export const isPublicInput = (input: SignupInput) =>
  input.type === 'group' ? publicSubFields(input).length > 0 : input.public

export const groupMin = (input: SignupInput) => Math.max(0, input.min ?? 0)
export const groupMax = (input: SignupInput) =>
  Math.min(MAX_GROUP_ITEMS, Math.max(groupMin(input), input.max ?? MAX_GROUP_ITEMS, 1))

// "Player 3", or "Substitute 1" for items after the minimum
export const groupItemLabel = (input: SignupInput, index: number) => {
  const min = groupMin(input)
  const itemLabel = input.itemLabel || 'Item'
  if (index >= min && input.extraLabel) return `${input.extraLabel} ${index - min + 1}`
  return `${itemLabel} ${index + 1}`
}

// The label of the next item to add, e.g. "Substitute"
export const groupAddLabel = (input: SignupInput, count: number) =>
  count >= groupMin(input) && input.extraLabel ? input.extraLabel : input.itemLabel || 'Item'

const asText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  // Single selects used to be saved as an array of one option
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') {
    return value[0].trim()
  }
  return ''
}

const asTextList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean)
  const text = asText(value)
  return text ? [text] : []
}

const isEmpty = (value: string | string[]) => (Array.isArray(value) ? !value.length : !value)

// Checks and cleans one text/textarea/select/image answer. Returns the value to store,
// or an error message.
const checkSimple = (
  input: SignupInput,
  raw: unknown
): { value: string | string[] } | { error: string } => {
  if (input.type === 'select') {
    const options = input.options ?? []
    if (input.multi) {
      const value = asTextList(raw)
      if (value.some((v) => !options.includes(v))) return { error: 'Choose from the options' }
      if (input.required && !value.length) return { error: 'Choose at least one' }
      return { value }
    }
    const value = asText(raw)
    if (value && !options.includes(value)) return { error: 'Choose from the options' }
    if (input.required && !value) return { error: 'Choose one' }
    return { value }
  }
  const value = asText(raw)
  if (input.required && !value) {
    return { error: input.type === 'image' ? 'Add an image' : 'Required' }
  }
  if (input.type === 'image') return { value }
  const max = input.type === 'textarea' ? MAX_TEXTAREA_LENGTH : MAX_TEXT_LENGTH
  if (value.length > max) return { error: `At most ${max} characters` }
  return { value }
}

const isBlankItem = (input: SignupInput, item: unknown) =>
  (input.fields ?? []).every((f) =>
    isEmpty(
      f.type === 'select' && f.multi
        ? asTextList(asRecord(item)[f.id])
        : asText(asRecord(item)[f.id])
    )
  )

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

// Checks the answers against the form. Returns the cleaned answers (only known
// fields, trimmed, blank extra group items dropped) and the errors by field path.
export const validateAnswers = (
  inputs: SignupInput[],
  raw: unknown
): { answers: AnswerMap; errors: AnswerErrors } => {
  const source = asRecord(raw)
  const answers: AnswerMap = {}
  const errors: AnswerErrors = {}

  answerInputs(inputs).forEach((input) => {
    const key = String(input.id)
    if (input.type === 'group') {
      const min = groupMin(input)
      const all = Array.isArray(source[key]) ? (source[key] as unknown[]) : []
      // Empty items someone added but didn't fill in are left out
      const items = all.filter((item, i) => i < min || !isBlankItem(input, item))
      if (items.length > groupMax(input)) {
        errors[key] = `At most ${groupMax(input)}`
      }
      while (items.length < min) items.push({})
      answers[key] = items.map((rawItem, index) => {
        const item: GroupItem = {}
        const record = asRecord(rawItem)
        ;(input.fields ?? []).forEach((sub) => {
          const result = checkSimple(sub, record[sub.id])
          if ('error' in result) errors[subFieldPath(input.id, index, sub.id)] = result.error
          else if (!isEmpty(result.value)) item[sub.id] = result.value
        })
        return item
      })
      return
    }
    const result = checkSimple(input, source[key])
    if ('error' in result) errors[key] = result.error
    else if (!isEmpty(result.value)) answers[key] = result.value
  })

  if (JSON.stringify(answers).length > MAX_ANSWERS_BYTES) {
    errors[''] = 'The answers are too long'
  }
  return { answers, errors }
}

// The answers everyone can see: public fields, and the public sub-fields of groups
export const publicAnswers = (answers: AnswerMap, inputs: SignupInput[]): AnswerMap => {
  const out: AnswerMap = {}
  inputs.forEach((input) => {
    const key = String(input.id)
    const value = answers[key]
    if (value === undefined || !isPublicInput(input)) return
    if (input.type !== 'group') {
      out[key] = value
      return
    }
    const subIds = publicSubFields(input).map((f) => String(f.id))
    out[key] = (Array.isArray(value) ? (value as GroupItem[]) : []).map((item) =>
      Object.fromEntries(Object.entries(asRecord(item)).filter(([id]) => subIds.includes(id)))
    ) as GroupItem[]
  })
  return out
}

// Image answers are an uploaded file's id, or a data URL before upload (and in previews)
export const imageUrl = (value: DataValue | undefined) => {
  if (typeof value !== 'string' || !value) return null
  return value.startsWith('data:') ? value : `/api/signups/files/${encodeURIComponent(value)}`
}

export const formatSimple = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map(formatSimple).filter(Boolean).join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return ''
  return String(value)
}

export const groupItems = (value: DataValue | undefined): GroupItem[] =>
  Array.isArray(value) ? (value.filter((v) => v && typeof v === 'object') as GroupItem[]) : []

// One line per answer, e.g. for the public list: group items are joined by commas.
// With onlyPublic, only the public sub-fields of groups are shown.
export const formatAnswer = (
  input: SignupInput,
  value: DataValue | undefined,
  onlyPublic = false
): string => {
  if (input.type === 'image') return value ? 'Image' : ''
  if (input.type !== 'group') return formatSimple(value)
  const subs = onlyPublic ? publicSubFields(input) : (input.fields ?? [])
  return groupItems(value)
    .map((item) =>
      subs
        .map((f) => formatSimple(item[f.id]))
        .filter(Boolean)
        .join(' · ')
    )
    .filter(Boolean)
    .join(', ')
}

const csvCell = (value: string) =>
  /[",\n\r;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

// All answers as CSV: one row per sign-up, group items flattened into columns
// ("Player 1 – Full name"), images as links
export const signupsToCsv = (
  inputs: SignupInput[],
  pools: SignupPool[],
  participants: SignupRow[],
  origin: string
): string => {
  const fields = answerInputs(inputs)
  const sorted = [...participants].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const header: string[] = []
  fields.forEach((input) => {
    if (input.type !== 'group') {
      header.push(input.title)
      return
    }
    const most = Math.max(
      groupMin(input),
      ...sorted.map((p) => groupItems(p.answers[input.id]).length)
    )
    for (let i = 0; i < most; i += 1) {
      ;(input.fields ?? []).forEach((f) => header.push(`${groupItemLabel(input, i)} – ${f.title}`))
    }
  })
  header.push('Pool', 'Status', 'Signed up at')

  const positions = new Map<number, number>()
  const rows = sorted.map((p) => {
    const cells: string[] = []
    fields.forEach((input) => {
      const value = p.answers[input.id]
      if (input.type === 'image') {
        const url = imageUrl(value)
        cells.push(url && !url.startsWith('data:') ? origin + url : '')
      } else if (input.type !== 'group') {
        cells.push(formatSimple(value))
      } else {
        const items = groupItems(value)
        const most = Math.max(
          groupMin(input),
          ...sorted.map((s) => groupItems(s.answers[input.id]).length)
        )
        for (let i = 0; i < most; i += 1) {
          ;(input.fields ?? []).forEach((f) => cells.push(formatSimple(items[i]?.[f.id])))
        }
      }
    })
    const poolId = resolvePoolId(pools, p.pool_id)
    const pool = pools.find((pl) => pl.id === poolId)
    const position = (positions.get(poolId) ?? 0) + 1
    positions.set(poolId, position)
    cells.push(
      pool?.name ?? '',
      pool && position > pool.size ? `Reserve ${position - pool.size}` : 'Has a place',
      new Date(p.created_at).toLocaleString('en-GB')
    )
    return cells
  })

  return [header, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\r\n')
}

// What's wrong with a form's fields, if anything
export const inputsError = (inputs: SignupInput[]): string | null => {
  if (inputs.filter((i) => i.type === 'image').length > 1) {
    return 'A form can have only one image field'
  }
  for (const input of inputs) {
    const name = `"${input.title}"`
    if (input.type === 'select' && !(input.options ?? []).length) {
      return `Dropdown ${name} needs options`
    }
    if (input.type !== 'group') continue
    const subs = input.fields ?? []
    if (!subs.length) return `Group ${name} needs at least one field`
    if (subs.some((f) => !(GROUP_SUB_FIELD_TYPES as readonly string[]).includes(f.type))) {
      return `Group ${name} can only have text, long text and dropdown fields`
    }
    if (subs.some((f) => f.type === 'select' && !(f.options ?? []).length)) {
      return `A dropdown in group ${name} needs options`
    }
    const ids = subs.map((f) => f.id)
    if (new Set(ids).size !== ids.length) return `Fields in group ${name} need unique ids`
    if ((input.max ?? MAX_GROUP_ITEMS) < (input.min ?? 0)) {
      return `Group ${name}: the maximum is smaller than the minimum`
    }
    if ((input.max ?? 0) > MAX_GROUP_ITEMS || (input.min ?? 0) > MAX_GROUP_ITEMS) {
      return `Group ${name} can have at most ${MAX_GROUP_ITEMS} items`
    }
  }
  return null
}

// The errors as one message, e.g. for API responses: "Players – Player 2 – Rank: Choose one"
export const describeErrors = (inputs: SignupInput[], errors: AnswerErrors): string | null => {
  const [path, message] = Object.entries(errors)[0] ?? []
  if (path === undefined) return null
  const [id, index, subId] = path.split('.').map(Number)
  const input = inputs.find((i) => i.id === id)
  if (!input) return message
  if (index === undefined || Number.isNaN(index)) return `${input.title}: ${message}`
  const sub = input.fields?.find((f) => f.id === subId)
  return `${input.title} – ${groupItemLabel(input, index)} – ${sub?.title ?? ''}: ${message}`
}
