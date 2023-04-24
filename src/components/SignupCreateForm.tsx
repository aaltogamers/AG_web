/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/jsx-props-no-spreading */
import moment from 'moment'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { getFirestore, setDoc, doc, collection, query, where, getDocs } from 'firebase/firestore'
import { FirebaseApp } from 'firebase/app'
import Input from './Input'
import { AGEvent, Data, EditableInputObj, EditableInputType, SignUpData } from '../types/types'
import EditableInput from './EditableInput'
import ParticipantTable from './ParticipantTable'
import { getParticipants } from '../utils/db'

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
  const { register, handleSubmit, setValue, reset, resetField, control } = useForm<Inputs>()
  const [signupData, setSignupData] = useState<SignUpData | null>(null)
  const [participants, setParticipants] = useState<Data[]>([])
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
            case 'public':
            case 'required':
              actualValue = value === true || value === 'true'
              break
            default:
              actualValue = value
          }
          setValue(`${number}-${key}` as keyof Inputs, actualValue as string)
        })
      })
      const newParticipants = await getParticipants(db, signUpData.name)
      setSignupData(signUpData)
      setParticipants(newParticipants)
    }
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
    getSignUpData(eventValuesSorted[0])
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
        const options = input.options.split(',').map((item: string) => item.trim())
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
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center text-xl">
        <div className="grid grid-cols-input w-2/3">
          <Input
            register={register}
            name="name"
            displayName="Event"
            options={eventValuesSorted}
            onChangeDo={(value) => getSignUpData(value)}
            control={control}
          />
          <Input
            register={register}
            name="maxParticipants"
            displayName="Maximum participants"
            placeHolder="ex. 24"
            type="number"
            control={control}
          />
          <Input
            register={register}
            name="openFrom"
            displayName="Sign-up open from"
            type="date"
            control={control}
          />
          <Input
            register={register}
            name="openUntil"
            displayName="Sign-up open until"
            type="date"
            control={control}
          />
        </div>
        <div className="flex flex-col md:flex-row w-full">
          <div className="w-full md:w-1/2">
            <div className="flex flex-col">
              <h3 className="text-center mt-4 mb-5">Sign-up Fields</h3>
              <h5 className="text-center text-lightGray">
                Don&apos;t edit input names or select options after signups have started. Stuff will
                break.
              </h5>
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
            <div className="flex justify-center mb-16">
              <button type="submit" className="mainbutton">
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
                db={db}
                setParticipants={setParticipants}
              />
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

export default SignUpCreateForm
