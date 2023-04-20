/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/jsx-props-no-spreading */
import moment from 'moment'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { getFirestore, setDoc, doc, collection, query, where, getDocs } from 'firebase/firestore'
import { FirebaseApp } from 'firebase/app'
import Input from './Input'
import { AGEvent, EditableInputObj, EditableInputType, SignUpData } from '../types/types'
import EditableInput from './EditableInput'

type Inputs = {
  name: string
  maxParticipants: string
  openFrom: string
  openUntil: string
  inputs: EditableInputObj[]
}

type Props = {
  events: AGEvent[]
  app: FirebaseApp
}

const SignUpCreateForm = ({ events, app }: Props) => {
  const db = getFirestore(app)
  const { register, handleSubmit, setValue, reset, getValues, resetField } = useForm<Inputs>()
  const [editableInputs, setEditableInputs] = useState<EditableInputObj[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const addEditableInput = (type: EditableInputType, predefinedNumber?: number) => {
    let max = 0
    editableInputs.forEach(({ number }) => {
      if (number > max) {
        max = number
      }
    })
    const number = predefinedNumber || max + 1
    setEditableInputs((oldInputs) => [...oldInputs, { number, type }])
    return number
  }

  const resetForm = () => {
    reset()
    setEditableInputs([])
  }

  const getSignUpData = async (eventName: string) => {
    const q = query(collection(db, 'events'), where('name', '==', eventName))
    const querySnapshot = await getDocs(q)
    if (querySnapshot.docs.length === 0) {
      resetForm()
      setValue('name', eventName)
    } else {
      const rawEvent = querySnapshot.docs[0]
      const signUpData = rawEvent.data() as SignUpData
      resetForm()
      setValue('name', signUpData.name)
      setValue('maxParticipants', signUpData.maxParticipants.toString())
      setValue('openFrom', signUpData.openFrom)
      setValue('openUntil', signUpData.openUntil)
      signUpData.inputs.forEach(({ type, ...rest }, i) => {
        const number = i + 1
        addEditableInput(type, number)
        Object.entries(rest).forEach(([key, value]) => {
          let actualValue = value
          switch (key) {
            case 'options':
              actualValue = (value as string[]).join(', ')
              break
            default:
              actualValue = value
          }
          setValue(`${number}-${key}` as keyof Inputs, actualValue as string)
        })
      })
    }
  }

  useEffect(() => {
    const values = getValues()
    getSignUpData(values.name)
  }, [])

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    const finalData = data
    const entries = Object.entries(data)
    const inputs = editableInputs.map(({ number }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = {}
      const keyStart = `${number}-`
      const entriesForInput = entries.filter(([key]) => key.includes(keyStart))
      entriesForInput.forEach(([key, value]) => {
        delete finalData[key as keyof Inputs]
        const newKey = key.replace(keyStart, '')
        obj[newKey] = value
      })
      return obj
    })
    finalData.inputs = inputs.map((input) => {
      if (input.type === 'select') {
        const options = input.options.split(',')
        return {
          ...input,
          options,
        }
      }
      return input
    })
    Object.entries(finalData).forEach(([key, value]) => {
      if (value === undefined) {
        delete finalData[key as keyof Inputs]
      }
    })
    const maxParticipantsAsInt = parseInt(finalData.maxParticipants.toString(), 10) || 0
    setDoc(doc(db, 'events', finalData.name), {
      ...finalData,
      maxParticipants: maxParticipantsAsInt,
    })
      .then(() => {
        setMessage('Saved!')
        setTimeout(() => setMessage(null), 2000)
      })
      .catch((error) => setMessage(`Error: ${error}`))
  }

  const nowMoment = moment()

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
    const fields = ['title', 'description', 'options', 'required', 'public', 'type']
    fields.forEach((key) => {
      resetField(`${number}-${key}` as keyof Inputs)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center text-xl">
      <div className="grid grid-cols-input w-2/3">
        <Input
          register={register}
          name="name"
          displayName="Event"
          options={events
            .sort((event1, event2) => {
              const event1Moment = moment(event1.time || nowMoment, 'DD-MM-YYYY')
              const event2Moment = moment(event2.time || nowMoment, 'DD-MM-YYYY')
              return event1Moment.isBefore(event2Moment) ? 1 : -1
            })
            .map((event) => event.name)}
          onChange={(e) => getSignUpData(e.target.value)}
        />
        <Input
          register={register}
          name="maxParticipants"
          displayName="Maximum participants"
          placeHolder="ex. 24"
          type="number"
        />
        <Input register={register} name="openFrom" displayName="Sign-up open from" type="date" />
        <Input register={register} name="openUntil" displayName="Sign-up open until" type="date" />
      </div>
      <div className="flex flex-col w-2/3">
        <h2 className="text-center mt-8 mb-4">Sign-up Fields</h2>
        {editableInputs.map((thisObj, i) => (
          <EditableInput
            thisObj={thisObj}
            register={register}
            handleUp={editableInputUp}
            handleDown={editableInputDown}
            handleDelete={editableInputDelete}
            index={i}
            lastIndex={editableInputs.length - 1}
            key={thisObj.number}
          />
        ))}
      </div>
      <div className="w-full flex justify-center gap-4">
        <button type="button" onClick={() => addEditableInput('text')}>
          Add text input
        </button>
        <button type="button" onClick={() => addEditableInput('select')}>
          Add select input
        </button>
        <button type="button" onClick={() => addEditableInput('info')}>
          Add info box
        </button>
      </div>
      <div className="text-center h-4 mb-8 mt-4">{message}</div>
      <div className="flex justify-center mb-16">
        <button type="submit" className="mainbutton">
          Save changes
        </button>
      </div>
    </form>
  )
}

export default SignUpCreateForm
