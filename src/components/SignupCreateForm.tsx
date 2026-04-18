import moment from 'moment'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useEffect, useState } from 'react'
import Input from './Input'
import {
  AGEvent,
  EditableInputObj,
  EditableInputType,
  SignupInput,
  SignUpData,
  SignupRow,
} from '../types/types'
import EditableInput from './EditableInput'
import ParticipantTable from './ParticipantTable'
import {
  getSignupEvent,
  listSignups,
  saveSignupEvent,
  SignupEvent,
} from '../utils/signupApi'

type Inputs = {
  name: string
  maxparticipants: string
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
  }

  const loadParticipants = async (eventName: string) => {
    const { signups } = await listSignups(eventName)
    setParticipants(signups)
  }

  const loadEvent = async (eventName: string) => {
    const event = await getSignupEvent(eventName)
    if (!event) {
      resetForm()
      setValue('name', eventName)
      setSignupData(null)
      setParticipants([])
      return
    }
    resetForm()
    setValue('name', event.name)
    setValue('maxparticipants', event.maxparticipants.toString())
    setValue(
      'openfrom',
      moment(event.openfrom).format('YYYY-MM-DDTHH:mm')
    )
    setValue(
      'openuntil',
      moment(event.openuntil).format('YYYY-MM-DDTHH:mm')
    )
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
    await loadParticipants(event.name)
  }

  const nowMoment = moment()
  const eventValuesSorted = events
    .sort((event1, event2) => {
      const event1Moment = moment(event1.time || nowMoment, 'DD-MM-YYYY')
      const event2Moment = moment(event2.time || nowMoment, 'DD-MM-YYYY')
      return event1Moment.isBefore(event2Moment) ? 1 : -1
    })
    .map((event) => event.name)

  useEffect(() => {
    if (eventValuesSorted[0]) loadEvent(eventValuesSorted[0])
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

    const payload: SignUpData = {
      name: data.name,
      maxparticipants: parseInt(data.maxparticipants.toString(), 10) || 0,
      openfrom: new Date(data.openfrom).toISOString(),
      openuntil: new Date(data.openuntil).toISOString(),
      inputs,
    }

    try {
      const saved = await saveSignupEvent(payload)
      setSignupData(saved)
      setMessage('Saved!')
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

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center text-xl">
        <div className="grid grid-cols-input w-2/3">
          <Input
            register={register}
            name="name"
            displayName="Event"
            options={eventValuesSorted}
            onChangeDo={(value) => loadEvent(value)}
            control={control}
            required
          />
          <Input
            register={register}
            name="maxparticipants"
            displayName="Maximum participants"
            placeHolder="ex. 24"
            type="number"
            control={control}
            required
          />
          <Input
            register={register}
            name="openfrom"
            displayName="Sign-up open from"
            type="datetime-local"
            control={control}
            required
          />
          <Input
            register={register}
            name="openuntil"
            displayName="Sign-up open until"
            type="datetime-local"
            control={control}
            required
          />
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
                const duplicate =
                  Number.isFinite(rawId) && rawId > 0 && duplicateIdSet.has(rawId)
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
                disabled={hasDuplicateIds}
              >
                Save changes
              </button>
            </div>
          </div>
          <div className="flex flex-col w-full md:w-1/2">
            {signupData && (
              <ParticipantTable
                signupData={signupData}
                participants={participants}
                showPrivateData
                allowEdit
                onChange={() => loadParticipants(signupData.name)}
              />
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

export default SignUpCreateForm
