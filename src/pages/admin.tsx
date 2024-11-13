/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/jsx-props-no-spreading */
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useState, useEffect } from 'react'
import Head from 'next/head'
import Input from '../components/Input'
import PageWrapper from '../components/PageWrapper'
import { AGEvent } from '../types/types'
import SignUpCreateForm from '../components/SignupCreateForm'
import { getFolder } from '../utils/fileUtils'
import { firebaseConfig } from '../utils/db'
import BetManagement from '../components/BetManagement'
import MapBanMangement from '../components/MapBanManagement'

type Props = {
  events: AGEvent[]
}

type Inputs = {
  password: string
}

const Admin = ({ events }: Props) => {
  const app = initializeApp(firebaseConfig)
  const auth = getAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    control,
  } = useForm<Inputs>()
  const [reload, setReload] = useState(false)
  const [tab, setTab] = useState<'signups' | 'bets' | 'mapbans'>('signups')
  const onSubmit: SubmitHandler<Inputs> = (data) => {
    const email = 'board@aaltogamers.fi'
    signInWithEmailAndPassword(auth, email, data.password)
      .then(() => {
        setReload(!reload)
      })
      .catch((error) => {
        const errorMessage = error.message
        const errorCode = error.code
        if (errorCode === 'auth/wrong-password') {
          setError('password', { type: 'manual', message: 'Wrong password' })
        } else {
          setError('password', { type: 'manual', message: errorMessage })
        }
      })
  }

  useEffect(() => {
    if (auth?.currentUser && auth?.currentUser?.email !== 'board@aaltogamers.fi') {
      signOut(auth)
    }
    auth.onAuthStateChanged((user) => {
      if (user) {
        setReload(!reload)
      }
    })
  }, [])

  return (
    <PageWrapper>
      <Head>
        <title>Admin - Aalto Gamers</title>
      </Head>
      <div className="mt-8">
        {auth?.currentUser?.email === 'board@aaltogamers.fi' ? (
          <div>
            <div className="flex gap-8 justify-center mb-20 text-4xl">
              <button
                className={`${tab === 'signups' && 'underline'}`}
                onClick={() => setTab('signups')}
              >
                Signups
              </button>
              <button className={`${tab === 'bets' && 'underline'}`} onClick={() => setTab('bets')}>
                Bets
              </button>
              <button
                className={`${tab === 'mapbans' && 'underline'}`}
                onClick={() => setTab('mapbans')}
              >
                Map Bans
              </button>
            </div>
            {tab === 'signups' ? (
              <SignUpCreateForm app={app} events={events} />
            ) : tab === 'bets' ? (
              <BetManagement app={app} />
            ) : (
              <MapBanMangement app={app} />
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center">
            <Input
              control={control}
              register={register}
              name="password"
              defaultValue=""
              displayName="AG Admin password"
              type="password"
            />
            {errors.password && <p className="text-red">{errors.password.message}</p>}
            <input type="submit" className="text-white p-4 text-2xl hover:cursor-pointer" />
          </form>
        )}
      </div>
    </PageWrapper>
  )
}

export default Admin

export const getStaticProps = () => ({
  props: { events: getFolder('events') },
})
