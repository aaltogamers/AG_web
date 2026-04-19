import { useForm, SubmitHandler } from 'react-hook-form'
import { useState, useEffect } from 'react'
import Head from 'next/head'
import Input from '../components/Input'
import PageWrapper from '../components/PageWrapper'
import { AGEvent } from '../types/types'
import SignUpCreateForm from '../components/SignupCreateForm'
import { getFolder } from '../utils/fileUtils'
import BetManagement from '../components/BetManagement'
import MapBanMangement from '../components/MapBanManagement'
import SiteStatistics from '../components/SiteStatistics'
import { checkAdminSession, loginAdmin, logoutAdmin } from '../utils/adminAuth'

type Props = {
  events: AGEvent[]
}

type Inputs = {
  password: string
}

const Admin = ({ events }: Props) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    control,
  } = useForm<Inputs>()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)
  const [tab, setTab] = useState<'signups' | 'bets' | 'mapbans' | 'stats'>('signups')

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdminSession()
      setIsLoggedIn(ok)
      setCheckedSession(true)
    })()
  }, [])

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    const ok = await loginAdmin(data.password)
    if (!ok) {
      setError('password', { type: 'manual', message: 'Wrong password' })
      return
    }
    setIsLoggedIn(true)
  }

  const onLogout = async () => {
    await logoutAdmin()
    setIsLoggedIn(false)
  }

  return (
    <PageWrapper>
      <Head>
        <title>Admin - Aalto Gamers</title>
      </Head>
      <div className="mt-8">
        {!checkedSession ? (
          <div className="text-center">Checking session…</div>
        ) : isLoggedIn ? (
          <div>
            <div className="flex gap-8 justify-center mb-8 text-4xl">
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
              <a
                href="/cms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-4xl"
              >
                Content
              </a>
            </div>
            <div className="flex justify-end mb-12">
              <button className="borderbutton" onClick={onLogout}>
                Log out
              </button>
            </div>
            {tab === 'signups' ? (
              <SignUpCreateForm events={events} />
            ) : tab === 'bets' ? (
              <BetManagement />
            ) : tab === 'mapbans' ? (
              <MapBanMangement />
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
