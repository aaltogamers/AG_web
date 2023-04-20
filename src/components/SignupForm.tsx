/* eslint-disable react/jsx-props-no-spreading */
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  addDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { SignUpData } from '../types/types'
import Input from './Input'

const firebaseConfig = {
  apiKey: 'AIzaSyAWhfwD5GSsgZ8qzNyvn2kmNn3yVu0QaHY',
  authDomain: 'ag-web-ab4d9.firebaseapp.com',
  projectId: 'ag-web-ab4d9',
  storageBucket: 'ag-web-ab4d9.appspot.com',
  messagingSenderId: '477042062646',
  appId: '1:477042062646:web:ceb714216dc980f72b2f97',
}

type Props = {
  eventName: string
}
type Data = {
  [key: string | number]: any
}
const SignUp = ({ eventName }: Props) => {
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const [event, setEvent] = useState<SignUpData | null>(null)
  const [participants, setParticipants] = useState<Data[]>([])
  const { register, handleSubmit } = useForm()

  console.log(participants)

  const onSubmit: SubmitHandler<any> = async (data) => {
    const privateData: Data = {}
    const publicData: Data = {}
    Object.entries(data).forEach(([key, value]) => {
      const isPublic = key === 'event' || event?.inputs.find((input) => input.title === key)?.public
      if (isPublic) {
        publicData[key] = value
      } else {
        privateData[key] = value
      }
    })
    const res1 = await addDoc(collection(db, 'signups-public'), publicData)
    const { id } = res1
    await setDoc(doc(db, 'signups-private', id), privateData)
  }

  useEffect(() => {
    const getSignUpData = async () => {
      const q = query(collection(db, 'events'), where('name', '==', eventName))
      const snapshot = await getDocs(q)
      const rawEvent = snapshot.docs[0]
      const signUpData = rawEvent.data() as SignUpData
      setEvent(signUpData)
    }
    const getParticipantData = async () => {
      const q = query(collection(db, 'signups-public'), where('event', '==', eventName))
      const snapshot = await getDocs(q)
      const participants = snapshot.docs.map((doc) => doc.data())
      setParticipants(participants)
    }
    getSignUpData()
    getParticipantData()
  }, [])

  const participantHeaders = Object.keys(participants[0] || [])
    .filter((key) => key !== 'event')
    .sort(
      (a, b) =>
        (event?.inputs.findIndex((item) => item.title == a) || 0) -
        (event?.inputs.findIndex((item) => item.title === b) || 0)
    )

  return (
    event && (
      <div id="signup" className="flex flex-col gap-2">
        <h2>Sign up </h2>
        <h3 className="mb-4">{event.name}</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="flex-col grid grid-cols-input w-2/3 text-xl">
            {event.inputs.map((input) => {
              switch (input.type) {
                case 'text':
                  return (
                    <Input
                      register={register}
                      name={input.title}
                      displayName={input.title}
                      placeHolder={input.description}
                      type="text"
                      key={input.title}
                      required={input.required}
                      isPublic={input.public}
                    />
                  )
                case 'select':
                  return (
                    <Input
                      register={register}
                      name={input.title}
                      displayName={input.title}
                      options={input.options}
                      key={input.title}
                      required={input.required}
                      isPublic={input.public}
                    />
                  )
                case 'info':
                  return (
                    <div className="col-span-2" key={input.title}>
                      <b>{input.title}</b>
                      <p>{input.description}</p>
                    </div>
                  )
                default:
                  return null
              }
            })}
            <input type="hidden" value={event.name} {...register('event')} />
            <div className="col-span-2 flex justify-center">
              <button type="submit" className="mainbutton">
                Sign up
              </button>
            </div>
          </div>
        </form>
        <div>
          <h3 className="mt-4">
            Participants {participants.length} / {event.maxParticipants}
          </h3>
          <table className="table-auto">
            <tr>
              {participantHeaders.map((header) => (
                <th className="text-left p-2 pl-0">{header}</th>
              ))}
            </tr>
            {participants.map((participant) => (
              <tr>
                {participantHeaders.map((header) => (
                  <td className="p-2 pl-0">{participant[header]}</td>
                ))}
              </tr>
            ))}
          </table>
        </div>
      </div>
    )
  )
}

export default SignUp
