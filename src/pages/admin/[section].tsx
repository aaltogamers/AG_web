import type { GetServerSideProps } from 'next'
import type { ParsedUrlQuery } from 'querystring'
import AdminPage from '../../components/AdminPage'
import { AGEvent } from '../../types/types'
import { getEvents } from '../../utils/eventStore'
import { AdminSection, isAdminSection } from '../../utils/adminSections'

type Props = {
  events: AGEvent[]
  section: AdminSection
}

interface Params extends ParsedUrlQuery {
  section: string
}

const AdminSectionPage = ({ events, section }: Props) => (
  <AdminPage events={events} section={section} />
)

export default AdminSectionPage

export const getServerSideProps: GetServerSideProps<Props, Params> = async ({ params, query }) => {
  const raw = params?.section
  // Sign-up forms are edited in the event editor now; old links (?event=<sign-up key>) go there
  if (raw === 'signups') {
    const key = typeof query.event === 'string' ? query.event : ''
    const slug = key.split(':')[0]
    const destination = slug
      ? `/admin/events?event=${encodeURIComponent(slug)}&signup=${encodeURIComponent(key)}`
      : '/admin/events'
    return { redirect: { destination, permanent: false } }
  }
  if (!isAdminSection(raw)) {
    return { notFound: true }
  }
  return {
    props: {
      events: await getEvents(),
      section: raw,
    },
  }
}
