import type { GetServerSideProps } from 'next'
import AdminPage from '../../components/AdminPage'
import LinksSection from '../../components/LinksSection'
import { getLinkTargetGroups, LinkTargetGroup } from '../../utils/linkTargets'

type Props = { groups: LinkTargetGroup[]; initialLinkId: string | null }

// Tagged links with their visitor stats, and QR codes for them and other links
const LinksPage = ({ groups, initialLinkId }: Props) => (
  <AdminPage events={[]} section="links">
    <LinksSection groups={groups} initialLinkId={initialLinkId} />
  </AdminPage>
)

export default LinksPage

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => ({
  props: {
    groups: await getLinkTargetGroups(),
    initialLinkId: typeof query.link === 'string' ? query.link : null,
  },
})
