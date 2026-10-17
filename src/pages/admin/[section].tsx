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

export const getServerSideProps: GetServerSideProps<Props, Params> = async ({ params }) => {
  const raw = params?.section
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
