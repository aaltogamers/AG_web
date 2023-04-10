/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/jsx-props-no-spreading */
import { useForm, SubmitHandler } from 'react-hook-form'
import { useState } from 'react'
import moment from 'moment'

import Input from '../components/Input'
import PageWrapper from '../components/PageWrapper'
import { getFolder } from '../utils/fileUtils'
import { AGEvent, EditableInputObj, EditableInputType } from '../types/types'
import EditableInput from '../components/EditableInput'

type Inputs = {
  eventName: string
  maxParticipants: string
  openFrom: string
  openTill: string
  inputs: EditableInputObj[]
}

type Props = {
  events: AGEvent[]
}

const SignUps = ({ events }: Props) => {
  const { register, handleSubmit } = useForm<Inputs>()
  const [editableInputs, setEditableInputs] = useState<EditableInputObj[]>([])
  const onSubmit: SubmitHandler<Inputs> = (data) => {
    const finalData = data
    const entries = Object.entries(data)
    const inputs = editableInputs.map(({ number }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = {}
      const keyStart = `${number}-`
      const entriesForInput = entries.filter(([key]) => key.includes(keyStart))
      entriesForInput.forEach(([key, value]) => {
        delete finalData[key]
        const newKey = key.replace(keyStart, '')
        obj[newKey] = value
      })
      return obj
    })
    finalData.inputs = inputs
    console.log(finalData)
  }
  const nowMoment = moment()

  const addEditableInput = (type: EditableInputType) => {
    let max = 0
    editableInputs.forEach(({ number }) => {
      if (number > max) {
        max = number
      }
    })
    const number = max + 1
    setEditableInputs((oldInputs) => [...oldInputs, { number, type }])
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
  }

  return (
    <PageWrapper>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center">
        <div className="grid grid-cols-input">
          <label className="flex items-center">Event</label>
          <select {...register('eventName')} className="p-2">
            {events
              .sort((event1, event2) => {
                const event1Moment = moment(event1.time || nowMoment, 'DD-MM-YYYY')
                const event2Moment = moment(event2.time || nowMoment, 'DD-MM-YYYY')
                return event1Moment.isBefore(event2Moment) ? 1 : -1
              })
              .map((event) => (
                <option key={event.name}>{event.name}</option>
              ))}
          </select>
          <Input
            register={register}
            name="maxParticipants"
            displayName="Maximum participants"
            placeHolder="24"
            type="number"
          />
          <Input register={register} name="openFrom" displayName="Sign-up open from" type="date" />
          <Input register={register} name="openTill" displayName="Sign-up open till" type="date" />
        </div>
        <div className="flex flex-col w-1/2">
          <h4 className="text-center">Sign-up fields</h4>
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
        <input type="submit" className="text-white p-4 text-2xl hover:cursor-pointer" />
      </form>
    </PageWrapper>
  )
}

export default SignUps

export const getStaticProps = () => ({
  props: { events: getFolder('events') },
})
