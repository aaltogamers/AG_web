import type { GetStaticPaths, GetStaticProps } from 'next'
import type { ParsedUrlQuery } from 'querystring'
import AdminPage from '../../components/AdminPage'
import { AGEvent } from '../../types/types'
import { getEvents } from '../../utils/fileUtils'
import { ADMIN_SECTIONS, AdminSection, isAdminSection } from '../../utils/adminSections'

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
      events: getEvents(),
      section: raw,
    },
  }
}
