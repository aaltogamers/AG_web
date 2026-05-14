import Head from 'next/head'
import { useEffect, useState } from 'react'
import PageWrapper from '../../components/PageWrapper'
import AdminLoginForm from '../../components/AdminLoginForm'
import TournamentList from '../../components/TournamentList'
import { checkAdminSession, logoutAdmin } from '../../utils/adminAuth'

const TournamentsAdminPage = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdminSession()
      setIsLoggedIn(ok)
      setCheckedSession(true)
    })()
  }, [])

  const onLogout = async () => {
    await logoutAdmin()
    setIsLoggedIn(false)
  }

  return (
    <PageWrapper>
      <Head>
        <title>Tournaments - Aalto Gamers</title>
      </Head>
      <div className="mt-8">
        {!checkedSession ? (
          <div className="text-center">Checking session…</div>
        ) : isLoggedIn ? (
          <>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-4xl">Tournaments</h2>
              <button type="button" className="borderbutton" onClick={onLogout}>
                Log out
              </button>
            </div>
            <TournamentList />
          </>
        ) : (
          <AdminLoginForm onLoggedIn={() => setIsLoggedIn(true)} />
        )}
      </div>
    </PageWrapper>
  )
}

export default TournamentsAdminPage
