import { ReactNode, useEffect, useState } from 'react'
import Head from 'next/head'
import PageWrapper from './PageWrapper'
import AdminLoginForm from './AdminLoginForm'
import AdminDashboard from './AdminDashboard'
import { AGEvent } from '../types/types'
import { checkAdminSession, logoutAdmin } from '../utils/adminAuth'
import { AdminSection } from '../utils/adminSections'

type Props = {
  events: AGEvent[]
  section: AdminSection
  // Shown instead of the section's own content
  children?: ReactNode
}

// An admin page: the login form, or the dashboard once logged in
const AdminPage = ({ events, section, children }: Props) => {
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
        <title>Admin - Aalto Gamers</title>
      </Head>
      <div className="mt-8">
        {!checkedSession ? (
          <div className="text-center">Checking session…</div>
        ) : isLoggedIn ? (
          <AdminDashboard section={section} events={events} onLogout={onLogout}>
            {children}
          </AdminDashboard>
        ) : (
          <AdminLoginForm onLoggedIn={() => setIsLoggedIn(true)} />
        )}
      </div>
    </PageWrapper>
  )
}

export default AdminPage
