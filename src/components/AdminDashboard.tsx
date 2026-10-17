import { ReactNode, useEffect } from 'react'
import Link from 'next/link'
import { AGEvent } from '../types/types'
import BetManagement from './BetManagement'
import MapBanMangement from './MapBanManagement'
import { AdminSection } from '../utils/adminSections'
import PostsSection from './posts/PostsSection'
import EventsSection from './events/EventsSection'

type Props = {
  section: AdminSection
  events: AGEvent[]
  onLogout: () => void
  // Shown instead of the section, e.g. the posts settings
  children?: ReactNode
}

const tabClass = (active: boolean) => `text-4xl ${active ? 'underline' : ''}`

const AdminDashboard = ({ section, events, onLogout, children }: Props) => {
  // The events and calendar pages are in light mode
  useEffect(() => {
    if (section !== 'events' && section !== 'posts') return
    document.body.classList.add('admin-light')
    return () => document.body.classList.remove('admin-light')
  }, [section])

  return (
    <div>
      <div className="flex flex-wrap gap-8 justify-center mb-8 text-4xl">
        <Link href="/admin/events" className={tabClass(section === 'events')}>
          Events
        </Link>
        <Link href="/admin/posts" className={tabClass(section === 'posts')}>
          Calendar
        </Link>
        <Link href="/admin/bets" className={tabClass(section === 'bets')}>
          Bets
        </Link>
        <Link href="/admin/mapbans" className={tabClass(section === 'mapbans')}>
          Map Bans
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
      ) : section === 'events' ? (
        <EventsSection events={events} />
      ) : section === 'posts' ? (
        <PostsSection events={events} />
      ) : section === 'bets' ? (
        <BetManagement />
      ) : (
        <MapBanMangement />
      )}
    </div>
  )
}

export default AdminDashboard
