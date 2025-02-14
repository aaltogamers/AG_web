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
import moment from 'moment'
import { useEffect, useRef, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { Data, SignUpData } from '../types/types'
import { getParticipants } from '../utils/db'
import Input from './Input'
import ParticipantTable from './ParticipantTable'
import { FaCircleNotch } from 'react-icons/fa'
import { firebaseConfig } from '../utils/db'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

type Props = {
  eventName: string
}

const SignUp = ({ eventName }: Props) => {
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const auth = getAuth(app)
  const [signupData, setSignupData] = useState<SignUpData | null>(null)
  const [hasPossibleSignUp, setHasPossibleSignUp] = useState<boolean>(true)
  const [participants, setParticipants] = useState<Data[]>([])
  const hasAlreadySignedUp = useRef(false)
  const { register, handleSubmit, setValue, reset, control } = useForm()
  const [isNewUpdate, setIsNewUpdate] = useState(false)

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
    const newParticipants = await getParticipants(db, eventName)
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
    if (localStorageSignupId && window.confirm('Are you sure you want to remove your sign up?')) {
      setParticipants((oldParticipants) =>
        oldParticipants.filter((item) => item.id !== localStorageSignupId)
      )
      removeLocalStorageId()
      await deleteDoc(doc(db, 'signups', localStorageSignupId))
      reset()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit: SubmitHandler<any> = async (data) => {
    const localStorageSignupId = getLocalStorageId()
    if (hasAlreadySignedUp.current && localStorageSignupId) {
      const docRef = doc(db, 'signups', localStorageSignupId)
      const oldData = participants.find((item) => item.id === localStorageSignupId)
      const newData = { ...data, creationTime: oldData?.creationTime }
      await setDoc(docRef, newData)
    } else {
      const creationTime = serverTimestamp()
      const res = await addDoc(collection(db, 'signups'), { ...data, creationTime })
      const { id } = res
      setLocalStorageId(id)
    }
    await getParticipantData()
    setIsNewUpdate(true)
    setTimeout(() => {
      setIsNewUpdate(false)
    }, 2000)
  }

  useEffect(() => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        await signInWithEmailAndPassword(auth, 'guest@aaltogamers.fi', 'aaltogamerpassword')
      }
      await getSignUpData()
      await getParticipantData()
    })

    const getSignUpData = async () => {
      const q = query(collection(db, 'events'), where('name', '==', eventName))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const rawSignupDataEvent = snapshot.docs[0]
        const signUpData = rawSignupDataEvent.data() as SignUpData
        setSignupData(signUpData)
      } else {
        setHasPossibleSignUp(false)
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signUpStart = moment(signupData?.openFrom)
  const signUpStartString = signUpStart.format('DD/MM/YYYY HH:mm')
  const signUpEnd = moment(signupData?.openUntil)
  const signUpEndString = signUpEnd.format('DD/MM/YYYY HH:mm')
  const nowMoment = moment()
  const signUpNotYetOpen = nowMoment.isBefore(signUpStart)
  const signUpClosed = nowMoment.isAfter(signUpEnd)
  const signUpNotOpen = signUpNotYetOpen || signUpClosed
  return signupData ? (
    <div id="signup" className="flex flex-col gap-4">
      <h2>Sign up</h2>
      <h3>{signupData.name}</h3>
      <h5 className="mb-2">Open until {signUpEndString}</h5>
      {signUpNotOpen ? (
        <h5>{signUpClosed ? 'Sign-up has closed.' : `Sign-up opens on ${signUpStartString}.`}</h5>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="flex-col md:grid md:grid-cols-input text-xl">
            {signupData.inputs.map((input) => {
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
                      control={control}
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
                      isMulti={input.multi}
                      control={control}
                    />
                  )
                case 'info':
                  return (
                    <div className="col-span-2 mt-2 mb-8 md:my-4" key={input.title}>
                      <b>{input.title}</b>
                      <p>{input.description}</p>
                    </div>
                  )
                default:
                  return null
              }
            })}
            <div className="col-span-2 text-lightgray mb-4 text-sm">
              Never input any sensitive data on this form
            </div>
            <input type="hidden" value={signupData.name} {...register('event')} />
            <div className="col-span-2 flex justify-center gap-8">
              <div>
                <button type="submit" className="mainbutton flex gap-2">
                  {hasAlreadySignedUp.current ? 'Update sign-up' : 'Sign up'}
                  <div className="relative text-md">
                    <div className={`${isNewUpdate && 'checkmark'}`} />
                  </div>
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
      )}
      <ParticipantTable signupData={signupData} participants={participants} />
    </div>
  ) : hasPossibleSignUp ? (
    <FaCircleNotch className="spinner h-12" size={34} />
  ) : (
    <div className="h-12"></div>
  )
}

export default SignUp
