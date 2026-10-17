import { useEffect, useState } from 'react'
import { fetchPosts, fetchSettings } from '../../utils/social/postsClient'
import type { Channel, Post } from '../../utils/social/types'
import PostList, { nextTime } from '../posts/PostList'

type Props = {
  eventSlug: string
  // A post's id, or 'new'
  onOpen: (id: string) => void
}

// The posts of an event, newest first, and a button for a new one
const EventPostsList = ({ eventSlug, onOpen }: Props) => {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchPosts([], eventSlug), fetchSettings()])
      .then(([res, settings]) => {
        if (cancelled) return
        setPosts(
          res.posts
            .filter((p) => p.status !== 'cancelled')
            .sort((a, b) => (nextTime(b) ?? '').localeCompare(nextTime(a) ?? ''))
        )
        setChannels(settings.channels)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [eventSlug])

  return (
    <div className="flex flex-col gap-2">
      {error && <span className="text-sm text-red">{error}</span>}
      {!posts && !error && <span className="text-sm text-lightgray">Loading…</span>}
      {posts && (posts.length ? <PostList posts={posts} channels={channels} onOpen={onOpen} /> : <span className="text-sm text-lightgray">No posts.</span>)}
      <button type="button" className="borderbutton self-start" onClick={() => onOpen('new')}>
        + New post
      </button>
    </div>
  )
}

export default EventPostsList
