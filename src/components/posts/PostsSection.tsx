import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { AGEvent } from '../../types/types'
import { fetchPosts, fetchSettings } from '../../utils/social/postsClient'
import { POST_STATUS_LABELS, type Channel, type Post, type PostStatus } from '../../utils/social/types'
import PostCalendar from './PostCalendar'
import PostEditor from './PostEditor'
import PostList, { nextTime } from './PostList'

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
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [posts, setPosts] = useState<Post[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [awaiting, setAwaiting] = useState(0)
  const [error, setError] = useState<string | null>(null)

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

  if (openId) {
    return (
      <PostEditor
        key={openId}
        postId={openId === 'new' ? null : openId}
        events={events}
        onSaved={(id) => open(id)}
        onClose={() => {
          const query = { ...router.query }
          delete query.id
          router.push({ pathname: router.pathname, query }, undefined, { shallow: true })
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3 items-center">
        <button type="button" className="mainbutton" onClick={() => open('new')}>
          New post
        </button>
        <button type="button" className="borderbutton" onClick={() => setView(view === 'list' ? 'calendar' : 'list')}>
          {view === 'list' ? 'Calendar view' : 'List view'}
        </button>
        <Link href="/admin/posts/settings" className="borderbutton">
          Settings and channels
        </Link>
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
                className={`px-3 py-1 rounded-md border text-base ${i === filter ? 'border-red' : 'border-lightgray'}`}
              >
                {f.label}
                {i === 0 && awaiting > 0 && <span className="ml-2 bg-red rounded-full px-2 text-sm">{awaiting}</span>}
              </button>
            ))}
          </div>
          <PostList posts={posts} channels={channels} onOpen={open} />
        </>
      ) : (
        <PostCalendar posts={posts} channels={channels} onOpen={open} />
      )}
    </div>
  )
}

export default PostsSection
