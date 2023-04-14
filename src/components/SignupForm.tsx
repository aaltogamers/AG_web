/* eslint-disable react/jsx-props-no-spreading */
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore'
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

const SignUp = ({ eventName }: Props) => {
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const [event, setEvent] = useState<SignUpData | null>(null)
  const { register, handleSubmit } = useForm()

  const onSubmit: SubmitHandler<any> = (data) => {
    console.log(data)
  }

  useEffect(() => {
    const getSignUpData = async () => {
      const q = query(collection(db, 'events'), where('name', '==', eventName))
      const querySnapshot = await getDocs(q)
      const rawEvent = querySnapshot.docs[0]
      const signUpData = rawEvent.data() as SignUpData
      setEvent(signUpData)
    }
    getSignUpData()
  }, [])

  return (
    event && (
      <div id="signup">
        <h2>Sign up </h2>
        <h3>{event.name}</h3>
        <h4>0 / {event.maxParticipants}</h4>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center">
          <div className="flex-col grid grid-cols-input">
            {event.inputs.map((input) => {
              const lowerCaseTitle = input.title.toLowerCase()
              switch (input.type) {
                case 'text':
                  return (
                    <Input
                      register={register}
                      name={lowerCaseTitle}
                      displayName={input.title}
                      type="text"
                      key={input.title}
                      required={input.required}
                    />
                  )
                case 'select':
                  return (
                    <>
                      <label htmlFor={lowerCaseTitle}>
                        {input.title}
                        <span className="text-red">{input.required && '*'}</span>
                      </label>
                      <select {...register(lowerCaseTitle)} className="p-2" id={lowerCaseTitle}>
                        {input.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </>
                  )
                case 'info':
                  return (
                    <div className="col-span-2">
                      <p>{input.title}</p>
                      <p>{input.description}</p>
                    </div>
                  )
                default:
                  return null
              }
            })}
          </div>
          <input type="submit" className="text-white p-4 text-2xl hover:cursor-pointer" />
        </form>
      </div>
    )
  )
}

export default SignUp
