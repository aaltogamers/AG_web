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
import SiteStatistics from '../components/SiteStatistics'
import { loginAnalytics, logoutAnalytics } from '../utils/analyticsAuth'

type Props = {
  events: AGEvent[]
}

type Inputs = {
  password: string
}

const Admin = ({ events }: Props) => {
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    control,
  } = useForm<Inputs>()
  const [, setReload] = useState(false)
  const [tab, setTab] = useState<'signups' | 'bets' | 'mapbans' | 'stats'>('signups')
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    const email = 'board@aaltogamers.fi'

    // Log in to Firebase and analytics in parallel. Both must succeed.
    const [firebaseResult, analyticsOk] = await Promise.all([
      signInWithEmailAndPassword(auth, email, data.password)
        .then(() => ({ ok: true as const }))
        .catch((err: { code?: string; message?: string }) => ({ ok: false as const, err })),
      loginAnalytics(data.password),
    ])

    if (!firebaseResult.ok || !analyticsOk) {
      // Roll back whichever side succeeded so state stays consistent.
      if (firebaseResult.ok) await signOut(auth).catch(() => undefined)
      if (analyticsOk) await logoutAnalytics()

      if (!firebaseResult.ok && firebaseResult.err?.code === 'auth/wrong-password') {
        setError('password', { type: 'manual', message: 'Wrong password' })
      } else if (!analyticsOk && firebaseResult.ok) {
        setError('password', {
          type: 'manual',
          message: 'Analytics login failed (password mismatch with ADMIN_PASSWORD).',
        })
      } else {
        setError('password', {
          type: 'manual',
          message: firebaseResult.ok ? 'Login failed' : firebaseResult.err?.message ?? 'Login failed',
        })
      }
      return
    }

    setReload((r) => !r)
  }

  useEffect(() => {
    if (auth?.currentUser && auth?.currentUser?.email !== 'board@aaltogamers.fi') {
      signOut(auth)
      logoutAnalytics()
    }
    auth.onAuthStateChanged(async (user) => {
      if (!user) return
      // Firebase auto-restored the session, but our analytics cookie may have
      // expired. Verify it with a cheap ping; if it's gone, sign out so the
      // user re-enters the password to re-establish both sessions in sync.
      try {
        const ping = await fetch('/api/analytics/stats?from=1970-01-01&to=1970-01-02', {
          credentials: 'same-origin',
        })
        if (ping.status === 401) {
          await signOut(auth).catch(() => undefined)
          return
        }
      } catch {
        // network issue — fall through to treating the user as logged in
      }
      setReload((r) => !r)
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <button
                className={`${tab === 'stats' && 'underline'}`}
                onClick={() => setTab('stats')}
              >
                Statistics
              </button>
            </div>
            {tab === 'signups' ? (
              <SignUpCreateForm app={app} events={events} />
            ) : tab === 'bets' ? (
              <BetManagement app={app} />
            ) : tab === 'mapbans' ? (
              <MapBanMangement app={app} />
            ) : (
              <SiteStatistics />
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
