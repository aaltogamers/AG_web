import { initializeApp } from 'firebase/app'
import { getFirestore, collection, query, where, getDocs, DocumentData } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { SignupField } from '../types/types'
import Field from './Field'

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
  signupFields: SignupField[]
}

const SignUp = ({ eventName, signupFields }: Props) => {
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const [event, setEvent] = useState<DocumentData | null>(null)

  useEffect(() => {
    const getThing = async () => {
      const q = query(collection(db, 'events'), where('name', '==', eventName))
      const querySnapshot = await getDocs(q)
      const rawEvent = querySnapshot.docs[0]
      setEvent({ id: rawEvent.id, ...rawEvent.data() })
    }
    getThing()
  }, [])

  const signUp = (e) => {
    e.preventDefault()
    const form = e.target
    const formData = new FormData(form)
    const formJson = Object.fromEntries(formData.entries())
    console.log(formJson)
  }

  return (
    event && (
      <div id="signup">
        <h2>Sign up </h2>
        <h3>{event.name}</h3>
        <h4>0 / {event.maxParticipants}</h4>
        <form method="post" onSubmit={signUp} id="singupForm">
          {signupFields.map((field) => (
            <Field field={field} key={field.name} />
          ))}
          <input type="submit" value="Submit" />
        </form>
      </div>
    )
  )
}

export default SignUp
