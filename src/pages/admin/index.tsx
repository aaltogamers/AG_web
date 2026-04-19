import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PageWrapper from '../../components/PageWrapper'
import AdminLoginForm from '../../components/AdminLoginForm'
import { checkAdminSession } from '../../utils/adminAuth'

const AdminIndex = () => {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdminSession()
      setIsLoggedIn(ok)
      setCheckedSession(true)
    })()
  }, [])

  useEffect(() => {
    if (!checkedSession || !isLoggedIn) return
    void router.replace('/admin/signups')
  }, [checkedSession, isLoggedIn, router])

  return (
    <PageWrapper>
      <Head>
        <title>Admin - Aalto Gamers</title>
      </Head>
      <div className="mt-8">
        {!checkedSession ? (
          <div className="text-center">Checking session…</div>
        ) : isLoggedIn ? (
          <div className="text-center">Redirecting…</div>
        ) : (
          <AdminLoginForm onLoggedIn={() => setIsLoggedIn(true)} />
        )}
      </div>
    </PageWrapper>
  )
}

export default AdminIndex
