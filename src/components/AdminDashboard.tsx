import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { AGEvent } from '../types/types'
import SignUpCreateForm from './SignupCreateForm'
import BetManagement from './BetManagement'
import MapBanMangement from './MapBanManagement'
import SiteStatistics from './SiteStatistics'
import { AdminSection } from '../utils/adminSections'
import { fetchPosts } from '../utils/social/postsClient'
import PostsSection from './posts/PostsSection'

type Props = {
  section: AdminSection
  events: AGEvent[]
  onLogout: () => void
  // Shown instead of the section, e.g. the posts settings
  children?: ReactNode
}

const tabClass = (active: boolean) => `text-4xl ${active ? 'underline' : ''}`

const AdminDashboard = ({ section, events, onLogout, children }: Props) => {
  // Posts awaiting approval, shown as a badge on the Posts tab
  const [awaiting, setAwaiting] = useState(0)
  useEffect(() => {
    fetchPosts(['awaiting_approval'])
      .then((res) => setAwaiting(res.awaitingApproval))
      .catch(() => undefined)
  }, [section])

  return (
    <div>
      <div className="flex flex-wrap gap-8 justify-center mb-8 text-4xl">
        <Link href="/admin/signups" className={tabClass(section === 'signups')}>
          Signups
        </Link>
        <Link href="/admin/posts" className={tabClass(section === 'posts')}>
          Posts
          {awaiting > 0 && (
            <span className="ml-2 align-middle bg-red rounded-full px-2 text-base">{awaiting}</span>
          )}
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
      {children ? (
        children
      ) : section === 'signups' ? (
        <SignUpCreateForm events={events} />
      ) : section === 'posts' ? (
        <PostsSection events={events} />
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
