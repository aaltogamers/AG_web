import { useEffect, useState } from 'react'
import Head from 'next/head'
import type { GetStaticPaths, GetStaticProps } from 'next'
import type { ParsedUrlQuery } from 'querystring'
import PageWrapper from '../../components/PageWrapper'
import AdminLoginForm from '../../components/AdminLoginForm'
import AdminDashboard from '../../components/AdminDashboard'
import { AGEvent } from '../../types/types'
import { getFolder } from '../../utils/fileUtils'
import { checkAdminSession, logoutAdmin } from '../../utils/adminAuth'
import { ADMIN_SECTIONS, AdminSection, isAdminSection } from '../../utils/adminSections'

type Props = {
  events: AGEvent[]
  section: AdminSection
}

interface Params extends ParsedUrlQuery {
  section: string
}

const AdminSectionPage = ({ events, section }: Props) => {
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
          <AdminDashboard section={section} events={events} onLogout={onLogout} />
        ) : (
          <AdminLoginForm onLoggedIn={() => setIsLoggedIn(true)} />
        )}
      </div>
    </PageWrapper>
  )
}

export default AdminSectionPage

export const getStaticPaths: GetStaticPaths<Params> = () => ({
  paths: ADMIN_SECTIONS.map((section) => ({ params: { section } })),
  fallback: false,
})

export const getStaticProps: GetStaticProps<Props, Params> = ({ params }) => {
  const raw = params?.section
  if (!isAdminSection(raw)) {
    return { notFound: true }
  }
  return {
    props: {
      events: getFolder('events') as AGEvent[],
      section: raw,
    },
  }
}
