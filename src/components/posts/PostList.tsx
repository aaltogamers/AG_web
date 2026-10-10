import moment from 'moment'
import type { Channel, Post, PostStatus } from '../../utils/social/types'
import { POST_STATUS_LABELS } from '../../utils/social/types'

const SHORT = { telegram: 'TG', discord: 'DC', instagram: 'IG' } as const

// The post's first time that's still to come, or its last one
export const nextTime = (post: Post) => {
  const times = [
    ...post.targets.map((t) => t.sendAt ?? post.sendAt),
    post.websiteChange?.runAt ?? null,
  ]
    .filter((t): t is string => !!t)
    .sort()
  return times.find((t) => new Date(t) > new Date()) ?? times[times.length - 1] ?? null
}

// Drafts and posts awaiting approval stand out from scheduled ones
const ROW_CLASS: Partial<Record<PostStatus, string>> = {
  draft: 'border-dashed border-lightgray text-lightgray italic',
  awaiting_approval: 'border-yellow-400',
}

const BADGE_CLASS: Record<PostStatus, string> = {
  draft: 'border border-dashed border-lightgray',
  awaiting_approval: 'border border-yellow-400 text-yellow-400',
  scheduled: 'bg-red text-white not-italic',
  done: 'border border-lightgray/40',
  cancelled: 'border border-lightgray/40 line-through',
}

type Props = {
  posts: Post[]
  channels: Channel[]
  onOpen: (id: string) => void
}

const PostList = ({ posts, channels, onOpen }: Props) => {
  if (!posts.length) return <div className="text-center text-lightgray">No posts</div>
  return (
    <div className="flex flex-col gap-2">
      {posts.map((post) => {
        const time = nextTime(post)
        const problems = post.targets.filter((t) => t.status === 'failed' || t.status === 'held').length +
          (post.websiteChange?.status === 'failed' ? 1 : 0)
        return (
          <button
            key={post.id}
            type="button"
            onClick={() => onOpen(post.id)}
            className={`text-left border hover:border-red rounded-md p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-6 ${ROW_CLASS[post.status] ?? 'border-lightgray/40'}`}
          >
            <span className="md:w-40 text-sm">
              <span className={`rounded-sm px-2 ${BADGE_CLASS[post.status]}`}>{POST_STATUS_LABELS[post.status]}</span>
              {problems > 0 && <span className="text-red"> · ❗ {problems}</span>}
            </span>
            <span className="flex-1 font-bold">{post.title || `Post #${post.id}`}</span>
            <span className="text-sm text-lightgray">
              {post.targets
                .map((t) => {
                  const c = channels.find((ch) => ch.id === t.channelId)
                  return c ? `${SHORT[c.platform]} ${c.name}` : '?'
                })
                .join(', ')}
              {post.websiteChange && `${post.targets.length ? ', ' : ''}🌐 website`}
            </span>
            <span className="md:w-36 text-sm">{time ? moment(time).format('ddd D.M. HH:mm') : 'no time'}</span>
          </button>
        )
      })}
    </div>
  )
}

export default PostList
