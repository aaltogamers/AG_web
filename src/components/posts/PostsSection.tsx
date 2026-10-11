import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FaCalendarAlt, FaCog, FaList } from 'react-icons/fa'
import type { AGEvent } from '../../types/types'
import { fetchPosts, fetchSettings } from '../../utils/social/postsClient'
import { POST_STATUS_LABELS, type Channel, type Post, type PostStatus } from '../../utils/social/types'
import PostCalendar from './PostCalendar'
import PostEditor from './PostEditor'
import PostList, { nextTime } from './PostList'

const ViewSwitch = ({ view, onChange }: { view: 'list' | 'calendar'; onChange: (view: 'list' | 'calendar') => void }) => {
  const isCalendar = view === 'calendar'
  return (
    <label className="flex items-center gap-2 text-base cursor-pointer select-none">
      <span className={`flex items-center gap-1 ${isCalendar ? 'text-lightgray' : ''}`}>
        <FaList /> List
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isCalendar}
        aria-label="Calendar view"
        onClick={() => onChange(isCalendar ? 'list' : 'calendar')}
        className={`relative w-12 h-6 rounded-full transition-colors ${isCalendar ? 'bg-red' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isCalendar ? 'translate-x-6' : ''}`}
        />
      </button>
      <span className={`flex items-center gap-1 ${isCalendar ? '' : 'text-lightgray'}`}>
        <FaCalendarAlt /> Calendar
      </span>
    </label>
  )
}

const FILTERS: { label: string; statuses: PostStatus[] }[] = [
  { label: 'Awaiting approval', statuses: ['awaiting_approval'] },
  { label: 'Upcoming', statuses: ['draft', 'awaiting_approval', 'scheduled'] },
  { label: POST_STATUS_LABELS.draft, statuses: ['draft'] },
  { label: POST_STATUS_LABELS.scheduled, statuses: ['scheduled'] },
  { label: POST_STATUS_LABELS.done, statuses: ['done'] },
  { label: 'All', statuses: [] },
]

// The "Posts" admin tab: the list or calendar of posts, and the editor of one
// (/admin/posts?id=<id> or ?id=new)
const PostsSection = ({ events }: { events: AGEvent[] }) => {
  const router = useRouter()
  const openId = typeof router.query.id === 'string' ? router.query.id : null
  const [filter, setFilter] = useState(1)
  const [view, setView] = useState<'list' | 'calendar'>('calendar')
  const [posts, setPosts] = useState<Post[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [leadMinutes, setLeadMinutes] = useState(10)
  const [awaiting, setAwaiting] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Shown in the editor of a post that was just created
  const [savedMessage, setSavedMessage] = useState<{ text: string; isError?: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const [res, settings] = await Promise.all([
        fetchPosts(view === 'calendar' ? [] : FILTERS[filter].statuses),
        fetchSettings(),
      ])
      const sorted = [...res.posts].sort((a, b) => (nextTime(b) ?? '').localeCompare(nextTime(a) ?? ''))
      setPosts(sorted)
      setAwaiting(res.awaitingApproval)
      setChannels(settings.channels)
      setLeadMinutes(settings.settings.website.leadMinutes)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [filter, view])

  useEffect(() => {
    if (!openId) load()
  }, [load, openId])

  const open = (id: string) =>
    router.push({ pathname: router.pathname, query: { ...router.query, id } }, undefined, {
      shallow: true,
    })
  const openFromList = (id: string) => {
    setSavedMessage(null)
    open(id)
  }

  if (openId) {
    return (
      <PostEditor
        key={openId}
        postId={openId === 'new' ? null : openId}
        events={events}
        initialMessage={savedMessage}
        onSaved={(id, message) => {
          setSavedMessage(message)
          open(id)
        }}
        onClose={() => {
          setSavedMessage(null)
          const query = { ...router.query }
          delete query.id
          router.push({ pathname: router.pathname, query }, undefined, { shallow: true })
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <button type="button" className="mainbutton" onClick={() => openFromList('new')}>
          New post
        </button>
        <div className="flex items-center gap-6">
          <ViewSwitch view={view} onChange={setView} />
          <Link href="/admin/posts/settings" aria-label="Settings and channels" title="Settings and channels">
            <FaCog size={26} />
          </Link>
        </div>
      </div>
      {error && <div className="text-red">{error}</div>}
      {view === 'list' ? (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f, i) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setFilter(i)}
                className={`px-3 py-1 rounded-md border text-base bg-white ${i === filter ? 'border-red' : 'border-lightgray'}`}
              >
                {f.label}
                {i === 0 && awaiting > 0 && <span className="ml-2 bg-red text-white rounded-full px-2 text-sm">{awaiting}</span>}
              </button>
            ))}
          </div>
          <PostList posts={posts} channels={channels} onOpen={openFromList} />
        </>
      ) : (
        <PostCalendar posts={posts} channels={channels} events={events} leadMinutes={leadMinutes} onOpen={openFromList} />
      )}
    </div>
  )
}

export default PostsSection
