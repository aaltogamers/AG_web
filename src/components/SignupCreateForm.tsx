import moment from 'moment'
import { useForm, SubmitHandler, Controller } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { FaEdit, FaExternalLinkAlt, FaLock, FaLockOpen, FaTrash } from 'react-icons/fa'
import Input from './Input'
import {
  AGEvent,
  EditableInputObj,
  EditableInputType,
  SignupInput,
  SignupPool,
  SignUpData,
  SignupRow,
} from '../types/types'
import EditableInput from './EditableInput'
import {
  eventMoment,
  getSignupTargetLabel,
  getSignupTargets,
  getSignupTargetStart,
  SignupTarget,
} from '../utils/eventUtils'
import ParticipantTable from './ParticipantTable'
import SignupTimePicker from './SignupTimePicker'
import {
  deleteSignupEvent,
  getSignupEvent,
  listSignups,
  saveSignupEvent,
  SignupEvent,
} from '../utils/signupApi'
import { defaultPools } from '../utils/signupPools'

type Inputs = {
  // Label of the selected time & place
  target: string
  openfrom: string
  openuntil: string
  inputs: EditableInputObj[]
}

type Props = {
  events: AGEvent[]
}

const SignUpCreateForm = ({ events }: Props) => {
  const { register, handleSubmit, setValue, reset, resetField, control, getValues, watch } =
    useForm<Inputs>()
  const [signupData, setSignupData] = useState<SignupEvent | null>(null)
  const [participants, setParticipants] = useState<SignupRow[]>([])
  const [editableInputs, setEditableInputs] = useState<EditableInputObj[]>([])
  const [pools, setPools] = useState<SignupPool[]>(defaultPools())
  const [message, setMessage] = useState<string | null>(null)

  const getNextFieldId = (): number => {
    const used = new Set<number>()
    editableInputs.forEach(({ number }) => {
      const raw = getValues(`${number}-id` as keyof Inputs)
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) used.add(n)
    })
    let next = 1
    while (used.has(next)) next += 1
    return next
  }

  const addEditableInput = (type: EditableInputType, predefinedNumber?: number) => {
    let max = 0
    editableInputs.forEach(({ number }) => {
      if (number > max) max = number
    })
    const number = predefinedNumber || max + 1
    setEditableInputs((oldInputs) => [...oldInputs, { number, type }])
    if (!predefinedNumber) {
      const nextId = getNextFieldId()
      setValue(`${number}-id` as keyof Inputs, nextId as unknown as string)
    }
    return number
  }

  const resetForm = () => {
    reset()
    setEditableInputs([])
    setPools(defaultPools())
  }

  const updatePool = (id: number, changes: Partial<SignupPool>) => {
    setPools((old) => old.map((p) => (p.id === id ? { ...p, ...changes } : p)))
  }

  const addPool = () => {
    const nextId = Math.max(0, ...pools.map((p) => p.id)) + 1
    setPools((old) => [...old, { id: nextId, name: '', size: 0 }])
  }

  const removePool = (id: number) => {
    setPools((old) => old.filter((p) => p.id !== id))
  }

  const poolNames = pools.map((p) => p.name.trim().toLowerCase())
  const hasDuplicatePoolNames = new Set(poolNames).size !== poolNames.length

  // Only events with sign-ups enabled in the CMS, newest first
  const startOf = (target: SignupTarget) => {
    const start = getSignupTargetStart(target)
    return start ? eventMoment(start) : null
  }
  const targets = events
    .flatMap(getSignupTargets)
    .sort((a, b) => (startOf(b)?.valueOf() ?? 0) - (startOf(a)?.valueOf() ?? 0))
  const targetOptions = targets.map((target) => {
    const label = getSignupTargetLabel(target)
    const isDuplicate = targets.filter((t) => getSignupTargetLabel(t) === label).length > 1
    return {
      key: target.key,
      label: isDuplicate ? `${label} ${startOf(target)?.format('HH:mm') ?? ''}` : label,
    }
  })
  const keyForLabel = (label: string) => targetOptions.find((o) => o.label === label)?.key

  const selectedTarget = targets.find((t) => t.key === keyForLabel(watch('target')))
  // Presets in the time pickers are relative to this, in the browser's local time
  const selectedStart = selectedTarget ? (startOf(selectedTarget)?.clone().local() ?? null) : null

  const loadParticipants = async (signupKey: string) => {
    const { signups } = await listSignups(signupKey)
    setParticipants(signups)
  }

  const loadEvent = async (label: string) => {
    const signupKey = keyForLabel(label)
    const event = signupKey ? await getSignupEvent(signupKey) : null
    resetForm()
    setValue('target', label)
    if (!event) {
      setSignupData(null)
      setParticipants([])
      return
    }
    setPools(event.pools)
    setValue('openfrom', moment(event.openfrom).format('YYYY-MM-DDTHH:mm'))
    setValue('openuntil', moment(event.openuntil).format('YYYY-MM-DDTHH:mm'))
    event.inputs.forEach(({ type, ...rest }, i) => {
      const number = i + 1
      addEditableInput(type, number)
      setValue(`${number}-id` as keyof Inputs, rest.id as unknown as string)
      Object.entries(rest).forEach(([key, value]) => {
        if (key === 'id') return
        let actualValue: unknown = value
        switch (key) {
          case 'options':
            actualValue = (value as string[]).join(', ')
            break
          case 'public':
          case 'required':
          case 'multi':
            actualValue = value === true || value === 'true'
            break
          default:
            actualValue = value
        }
        setValue(`${number}-${key}` as keyof Inputs, actualValue as string)
      })
    })
    setSignupData(event)
    await loadParticipants(event.key)
  }

  useEffect(() => {
    if (targetOptions[0]) loadEvent(targetOptions[0].label)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const watchedIds = watch(
    editableInputs.map(({ number }) => `${number}-id` as keyof Inputs)
  ) as unknown as Array<number | string | undefined>
  const duplicateIdSet = (() => {
    const seen = new Map<number, number>()
    watchedIds.forEach((raw) => {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) seen.set(n, (seen.get(n) ?? 0) + 1)
    })
    const dup = new Set<number>()
    seen.forEach((count, n) => {
      if (count > 1) dup.add(n)
    })
    return dup
  })()
  const hasDuplicateIds = duplicateIdSet.size > 0

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    if (hasDuplicateIds) {
      setMessage('Error: field IDs must be unique.')
      return
    }
    if (hasDuplicatePoolNames) {
      setMessage('Error: pool names must be unique.')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = data as any
    const entries = Object.entries(raw)

    const usedIds = new Set<number>()
    let nextAutoId = 1
    const assignFreshId = (): number => {
      while (usedIds.has(nextAutoId)) nextAutoId += 1
      usedIds.add(nextAutoId)
      return nextAutoId
    }

    const rawInputs = editableInputs.map(({ number }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = { number }
      const keyStart = `${number}-`
      entries
        .filter(([key]) => key.startsWith(keyStart))
        .forEach(([key, value]) => {
          const newKey = key.replace(keyStart, '')
          obj[newKey] = value
        })
      return obj
    })

    // First pass: honour explicit IDs.
    rawInputs.forEach((inp) => {
      const n = Number(inp.id)
      if (Number.isFinite(n) && n > 0) {
        inp.id = n
        usedIds.add(n)
      } else {
        inp.id = null
      }
    })
    // Second pass: fill in blanks.
    rawInputs.forEach((inp) => {
      if (inp.id === null) inp.id = assignFreshId()
    })

    const inputs: SignupInput[] = rawInputs.map((inp) => {
      const base: SignupInput = {
        id: inp.id,
        number: inp.number,
        type: inp.type as EditableInputType,
        title: inp.title ?? '',
        public: Boolean(inp.public),
        required: Boolean(inp.required),
      }
      if (inp.description) base.description = inp.description
      if (inp.type === 'select') {
        base.options = (inp.options ?? '')
          .split(',')
          .map((opt: string) => opt.trim())
          .filter((opt: string) => opt.length > 0)
        base.multi = Boolean(inp.multi)
      }
      return base
    })

    const signupKey = keyForLabel(data.target)
    if (!signupKey) {
      setMessage('Error: choose a time & place.')
      return
    }

    if (!data.openfrom || !data.openuntil) {
      setMessage('Error: choose when sign-up opens and closes.')
      return
    }

    const payload: SignUpData = {
      key: signupKey,
      pools: pools.map((p) => ({ ...p, name: p.name.trim() })),
      openfrom: new Date(data.openfrom).toISOString(),
      openuntil: new Date(data.openuntil).toISOString(),
      inputs,
    }

    try {
      const saved = await saveSignupEvent(payload)
      setSignupData(saved)
      setPools(saved.pools)
      setMessage('Saved!')
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    }
  }

  const deleteEvent = async () => {
    if (!signupData) return
    const label = getValues('target')
    const count = participants.length
    if (
      !window.confirm(
        `Delete the whole sign-up for "${label}"? This removes all fields, pools and ${count} sign-up(s).`
      )
    ) {
      return
    }
    const answer = window.prompt('This cannot be undone. Type DELETE to confirm.')
    if (answer?.trim().toUpperCase() !== 'DELETE') return
    try {
      await deleteSignupEvent(signupData.key)
      resetForm()
      setValue('target', label)
      setSignupData(null)
      setParticipants([])
      setMessage('Sign-up deleted.')
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    }
  }

  const editableInputUp = (thisObj: EditableInputObj) => {
    const indexOfThis = editableInputs.findIndex((item) => item.number === thisObj.number)
    if (indexOfThis !== 0) {
      const firstPart = editableInputs.slice(0, indexOfThis - 1)
      const secondPart = editableInputs
        .slice(indexOfThis - 1)
        .filter((item) => item.number !== thisObj.number)
      setEditableInputs([...firstPart, thisObj, ...secondPart])
    }
  }

  const editableInputDown = (thisObj: EditableInputObj) => {
    const indexOfThis = editableInputs.findIndex(({ number }) => number === thisObj.number)
    if (indexOfThis !== editableInputs.length - 1) {
      const firstPart = editableInputs
        .slice(0, indexOfThis + 2)
        .filter(({ number }) => thisObj.number !== number)
      const secondPart = editableInputs
        .slice(indexOfThis + 2)
        .filter(({ number }) => thisObj.number !== number)
      setEditableInputs([...firstPart, thisObj, ...secondPart])
    }
  }

  const editableInputDelete = (number: number) => {
    setEditableInputs((oldInputs) => oldInputs.filter((item) => item.number !== number))
    const fields = ['id', 'title', 'description', 'options', 'required', 'public', 'multi', 'type']
    fields.forEach((key) => {
      resetField(`${number}-${key}` as keyof Inputs)
    })
  }

  if (!targets.length) {
    return (
      <p className="text-center">
        No events have sign-ups enabled. Choose a sign-up option for an event in the CMS.
      </p>
    )
  }

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center text-xl">
        <div className="grid grid-cols-input w-2/3">
          <Input
            register={register}
            name="target"
            displayName="Event"
            options={targetOptions.map((o) => o.label)}
            onChangeDo={(value) => loadEvent(value)}
            control={control}
            required
          />
          {selectedTarget && (
            <>
              <div />
              <div className="flex gap-2 -mt-6 mb-8 md:mx-4 md:mt-0 text-sm">
                <a
                  href={`/events/${selectedTarget.event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-lightgray rounded-md px-3 py-1 hover:border-red"
                >
                  <FaExternalLinkAlt size={12} />
                  Event page
                </a>
                <a
                  href={`/cms/#/collections/event/entries/${selectedTarget.event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-lightgray rounded-md px-3 py-1 hover:border-red"
                >
                  <FaEdit size={12} />
                  Edit event info
                </a>
              </div>
            </>
          )}
          <label className="flex items-center">
            Sign-up open from
            <span className="text-red">*</span>
          </label>
          <Controller
            control={control}
            name="openfrom"
            render={({ field: { value, onChange } }) => (
              <SignupTimePicker
                value={value ?? ''}
                onChange={onChange}
                eventStart={selectedStart}
                commonMargins="mt-2 mb-8 md:m-4"
              />
            )}
          />
          <label className="flex items-center">
            Sign-up open until
            <span className="text-red">*</span>
          </label>
          <Controller
            control={control}
            name="openuntil"
            render={({ field: { value, onChange } }) => (
              <SignupTimePicker
                value={value ?? ''}
                onChange={onChange}
                eventStart={selectedStart}
                commonMargins="mt-2 mb-8 md:m-4"
              />
            )}
          />
          <div className="flex flex-col justify-center">
            <div>
              Participant pools
              <span className="text-red">*</span>
            </div>
            <div className="text-sm text-lightgray">
              With more than one pool, participants choose which pool to sign up to.
            </div>
          </div>
          <div className="mt-2 mb-8 md:m-4 flex flex-col gap-2">
            {pools.map((p) => (
              <div className="flex flex-col gap-1" key={p.id}>
                <div className="flex items-center gap-2">
                  <input
                    value={p.name}
                    onChange={(e) => updatePool(p.id, { name: e.target.value })}
                    placeholder="Pool name"
                    className="p-2 rounded-md bg-white text-black flex-1 min-w-0"
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
                    className="p-2 rounded-md bg-white text-black w-20"
                    required
                  />
                  <button
                    type="button"
                    className={p.private ? 'text-red' : 'text-lightgray hover:text-red'}
                    onClick={() =>
                      updatePool(p.id, { private: !p.private, password: p.password ?? '' })
                    }
                    title={p.private ? 'Private: needs a password' : 'Public: anyone can join'}
                    aria-label={p.private ? 'Make pool public' : 'Make pool private'}
                  >
                    {p.private ? <FaLock size={14} /> : <FaLockOpen size={14} />}
                  </button>
                  {pools.length > 1 && (
                    <button
                      type="button"
                      className="text-lightgray hover:text-red"
                      onClick={() => removePool(p.id)}
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
                    className="p-2 rounded-md bg-white text-black text-base"
                    required
                  />
                )}
              </div>
            ))}
            {hasDuplicatePoolNames && (
              <div className="text-red text-sm">Pool names must be unique.</div>
            )}
            <div className="text-sm">
              <button type="button" className="link" onClick={addPool}>
                + Add pool
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row w-full">
          <div className="w-full md:w-1/2">
            <div className="flex flex-col">
              <h3 className="text-center mt-4 mb-5">Sign-up Fields</h3>
              <h5 className="text-center text-lightgray">
                Don&apos;t edit field IDs or select options after signups have started.
              </h5>
              {editableInputs.map((thisObj, i) => {
                const rawId = Number(watchedIds[i])
                const duplicate = Number.isFinite(rawId) && rawId > 0 && duplicateIdSet.has(rawId)
                return (
                  <EditableInput
                    thisObj={thisObj}
                    register={register}
                    handleUp={editableInputUp}
                    handleDown={editableInputDown}
                    handleDelete={editableInputDelete}
                    index={i}
                    lastIndex={editableInputs.length - 1}
                    duplicateId={duplicate}
                    key={thisObj.number}
                  />
                )
              })}
            </div>
            <div className="w-full flex justify-center gap-4 p-4">
              <button
                type="button"
                className="borderbutton"
                onClick={() => addEditableInput('text')}
              >
                Add text input
              </button>
              <button
                type="button"
                className="borderbutton"
                onClick={() => addEditableInput('select')}
              >
                Add select input
              </button>
              <button
                type="button"
                className="borderbutton"
                onClick={() => addEditableInput('info')}
              >
                Add info box
              </button>
            </div>
            <div className="text-center h-4 mb-8 mt-4">{message}</div>
            <div className="flex flex-col items-center mb-16">
              {hasDuplicateIds && (
                <div className="text-red mb-2">
                  Two or more fields share the same ID. IDs must be unique.
                </div>
              )}
              <button
                type="submit"
                className="mainbutton"
                disabled={hasDuplicateIds || hasDuplicatePoolNames}
              >
                Save changes
              </button>
              {signupData && (
                <button type="button" className="borderbutton mt-8 text-base" onClick={deleteEvent}>
                  Delete entire sign-up
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col w-full md:w-1/2">
            {signupData && (
              <ParticipantTable
                signupData={signupData}
                participants={participants}
                showPrivateData
                allowEdit
                onChange={() => loadParticipants(signupData.key)}
              />
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

export default SignUpCreateForm
