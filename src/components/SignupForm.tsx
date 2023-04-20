/* eslint-disable @typescript-eslint/no-explicit-any */
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
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { useEffect, useRef, useState } from 'react'
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
  const hasAlreadySignedUp = useRef(false)
  const { register, handleSubmit, setValue, reset } = useForm()

  const setLocalStorageId = (id: string) => {
    localStorage.setItem(`signupId-${eventName}`, id)
    hasAlreadySignedUp.current = true
  }

  const getLocalStorageId = () => {
    return localStorage.getItem(`signupId-${eventName}`)
  }

  const removeLocalStorageId = () => {
    hasAlreadySignedUp.current = false
    localStorage.removeItem(`signupId-${eventName}`)
  }

  const getParticipantData = async () => {
    const q = query(collection(db, 'signups'), where('event', '==', eventName))
    const snapshot = await getDocs(q)
    const newParticipants = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    const signupIdFromLocalStorage = getLocalStorageId()
    if (signupIdFromLocalStorage) {
      const signup = newParticipants.find((item) => item.id === signupIdFromLocalStorage)
      if (signup) {
        Object.entries(signup).forEach(([key, value]) => {
          setValue(key, value)
        })
        hasAlreadySignedUp.current = true
      }
    }
    setParticipants(newParticipants)
  }

  const removeSignUp = async () => {
    const localStorageSignupId = getLocalStorageId()
    if (localStorageSignupId) {
      setParticipants((oldParticipants) =>
        oldParticipants.filter((item) => item.id !== localStorageSignupId)
      )
      removeLocalStorageId()
      await deleteDoc(doc(db, 'signups', localStorageSignupId))
      reset()
    }
  }

  const onSubmit: SubmitHandler<any> = async (data) => {
    const localStorageSignupId = getLocalStorageId()
    if (hasAlreadySignedUp.current && localStorageSignupId) {
      const docRef = doc(db, 'signups', localStorageSignupId)
      await setDoc(docRef, data)
      setParticipants((oldParticipants) =>
        oldParticipants.map((item) => (item.id === localStorageSignupId ? data : item))
      )
    } else {
      const creationTime = serverTimestamp()
      const res = await addDoc(collection(db, 'signups'), { ...data, creationTime })
      const { id } = res
      setLocalStorageId(id)
      const dataWithId = { ...data, id }
      setParticipants((oldParticipants) => [...oldParticipants, dataWithId])
    }
  }

  useEffect(() => {
    const getSignUpData = async () => {
      const q = query(collection(db, 'events'), where('name', '==', eventName))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const rawSignupDataEvent = snapshot.docs[0]
        const signUpData = rawSignupDataEvent.data() as SignUpData
        setEvent(signUpData)
      }
    }
    getSignUpData()
    getParticipantData()
  }, [])

  const participantHeaders = Object.keys(participants[0] || [])
    .filter(
      (key) =>
        key !== 'event' && key !== 'id' && event?.inputs.find((item) => item.title === key)?.public
    )
    .sort(
      (a, b) =>
        (event?.inputs.findIndex((item) => item.title === a) || 0) -
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
            <div className="col-span-2 text-lightGray mb-4 text-sm">
              Never input any sensitive data on this form
            </div>
            <input type="hidden" value={event.name} {...register('event')} />
            <div className="col-span-2 flex justify-center gap-8">
              <div>
                <button type="submit" className="mainbutton">
                  {hasAlreadySignedUp.current ? 'Update sign-up' : 'Sign up'}
                </button>
              </div>
              {hasAlreadySignedUp.current && (
                <div>
                  <button type="button" className="mainbutton" onClick={removeSignUp}>
                    Remove sign-up
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
        <div>
          <h3 className="mt-4">
            Participants {participants.length} / {event.maxParticipants}
          </h3>
          <table className="table-auto">
            <thead>
              <tr>
                {participantHeaders.map((header) => (
                  <th className="text-left p-2 pl-0" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr key={participant[participantHeaders[0]]}>
                  {participantHeaders.map((header) => (
                    <td className="p-2 pl-0" key={participant[header]}>
                      {participant[header]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  )
}

export default SignUp
