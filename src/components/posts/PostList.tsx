import moment from 'moment'
import { FaChevronRight } from 'react-icons/fa'
import type { Channel, Post, PostStatus } from '../../utils/social/types'
import { POST_STATUS_LABELS } from '../../utils/social/types'
import ChannelChip, { TargetChip } from './ChannelChip'

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
  draft: 'border-dashed border-lightgray',
  awaiting_approval: 'border-yellow-400',
}

const BADGE_CLASS: Record<PostStatus, string> = {
  draft: 'border border-dashed border-lightgray',
  awaiting_approval: 'border border-yellow-400 text-yellow-400',
  scheduled: 'bg-red text-white',
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
            className={`group text-left border hover:border-red hover:shadow-md transition rounded-md px-3 py-2 bg-white flex flex-col md:flex-row md:items-center gap-2 md:gap-4 cursor-pointer ${ROW_CLASS[post.status] ?? 'border-lightgray/40'}`}
          >
            <span className="md:w-28 shrink-0 text-sm whitespace-nowrap">
              <span className={`rounded-sm px-2 ${BADGE_CLASS[post.status]}`}>{POST_STATUS_LABELS[post.status]}</span>
              {problems > 0 && <span className="text-red"> · ❗ {problems}</span>}
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="group-hover:text-red">{post.title || 'Untitled post'}</span>
              <span className="flex flex-wrap gap-1">
                {post.targets.map((t) => (
                  <TargetChip key={t.channelId} channel={channels.find((c) => c.id === t.channelId)} />
                ))}
                {post.websiteChange && <ChannelChip platform="website" label="Website" />}
              </span>
            </span>
            <span className="md:w-28 shrink-0 text-sm whitespace-nowrap text-lightgray">
              {time ? moment(time).format('ddd D.M. HH:mm') : 'no time'}
            </span>
            <FaChevronRight className="hidden md:block shrink-0 text-lightgray group-hover:text-red" />
          </button>
        )
      })}
    </div>
  )
}

export default PostList
