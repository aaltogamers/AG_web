import type { GetServerSideProps } from 'next'
import AdminPage from '../../components/AdminPage'
import QRCodeGenerator, { QRTargetGroup } from '../../components/QRCodeGenerator'
import { getEvents } from '../../utils/eventStore'
import { getRedirects } from '../../utils/redirects'

const BASE_URL = 'https://aaltogamers.fi'

const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Events', path: '/events' },
  { name: 'Join', path: '/join' },
  { name: 'About', path: '/about' },
  { name: 'Equipment', path: '/equipment' },
  { name: 'Partners', path: '/partners' },
  { name: 'Gallery', path: '/gallery' },
  { name: 'Tournaments', path: '/tournaments' },
]

type Props = { groups: QRTargetGroup[] }

const QRCodesPage = ({ groups }: Props) => (
  <AdminPage events={[]} section="qr">
    <QRCodeGenerator groups={groups} />
  </AdminPage>
)

export default QRCodesPage

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const events = (await getEvents()).filter((e) => {
    const end = e.sessions.at(-1)?.end
    return end && new Date(end).getTime() > weekAgo
  })

  const groups: QRTargetGroup[] = [
    {
      label: 'Redirect links',
      targets: getRedirects().map((r) => ({
        name: r.name,
        fileName: r.slug,
        url: `${BASE_URL}/link/${r.slug}`,
      })),
    },
    {
      label: 'Sign-ups',
      targets: events
        .filter((e) => e.signupMode !== 'none')
        .map((e) => ({
          name: `${e.name} sign-up`,
          fileName: `${e.slug}-signup`,
          url: `${BASE_URL}/events/${e.slug}#signups`,
        })),
    },
    {
      label: 'Events',
      targets: events.map((e) => ({
        name: e.name,
        fileName: e.slug,
        url: `${BASE_URL}/events/${e.slug}`,
      })),
    },
    {
      label: 'Pages',
      targets: PAGES.map((p) => ({
        name: p.name,
        fileName: p.path === '/' ? 'home' : p.path.slice(1),
        url: `${BASE_URL}${p.path}`,
      })),
    },
  ]

  return { props: { groups: groups.filter((g) => g.targets.length > 0) } }
}
