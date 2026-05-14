import Link from 'next/link'
import { AGEvent } from '../types/types'
import SignUpCreateForm from './SignupCreateForm'
import BetManagement from './BetManagement'
import MapBanMangement from './MapBanManagement'
import SiteStatistics from './SiteStatistics'
import { AdminSection } from '../utils/adminSections'

type Props = {
  section: AdminSection
  events: AGEvent[]
  onLogout: () => void
}

const tabClass = (active: boolean) => `text-4xl ${active ? 'underline' : ''}`

const AdminDashboard = ({ section, events, onLogout }: Props) => {
  return (
    <div>
      <div className="flex gap-8 justify-center mb-8 text-4xl">
        <Link href="/admin/signups" className={tabClass(section === 'signups')}>
          Signups
        </Link>
        <Link href="/admin/bets" className={tabClass(section === 'bets')}>
          Bets
        </Link>
        <Link href="/admin/mapbans" className={tabClass(section === 'mapbans')}>
          Map Bans
        </Link>
        <Link href="/admin/stats" className={tabClass(section === 'stats')}>
          Statistics
        </Link>
        <Link href="/tournaments" className="text-4xl">
          Tournaments
        </Link>
        <a href="/cms" target="_blank" rel="noopener noreferrer" className="text-4xl">
          Content
        </a>
      </div>
      <div className="flex justify-end mb-12">
        <button type="button" className="borderbutton" onClick={onLogout}>
          Log out
        </button>
      </div>
      {section === 'signups' ? (
        <SignUpCreateForm events={events} />
      ) : section === 'bets' ? (
        <BetManagement />
      ) : section === 'mapbans' ? (
        <MapBanMangement />
      ) : (
        <SiteStatistics />
      )}
    </div>
  )
}

export default AdminDashboard
