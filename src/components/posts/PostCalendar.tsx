import { Calendar as BigCalendar, momentLocalizer, type View } from 'react-big-calendar'
import moment from 'moment'
import { type CSSProperties, useState } from 'react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import type { Channel, Platform, Post, PostStatus } from '../../utils/social/types'
import { PLATFORM_STYLE } from './ChannelChip'

// Weeks start on Monday, like the events calendar
moment.locale('en-GB', { week: { dow: 1, doy: 1 } })
const localizer = momentLocalizer(moment)

type Entry = {
  title: string
  start: Date
  end: Date
  postId: string
  status: PostStatus
  platform: Platform | 'website'
  done: boolean
}

// Drafts and posts awaiting approval are shown, but clearly not scheduled
const PREFIX: Partial<Record<PostStatus, string>> = { draft: 'DRAFT · ', awaiting_approval: '⏳ ' }

// In the platform's colour: filled when approved, outlined when not
const entryStyle = ({ status, done, platform }: Entry): CSSProperties => {
  const { color } = PLATFORM_STYLE[platform]
  if (status === 'draft') {
    return { backgroundColor: '#fff', border: `2px dashed ${color}`, color, fontStyle: 'italic' }
  }
  if (status === 'awaiting_approval') {
    return { backgroundColor: '#fff', border: `2px solid ${color}`, color }
  }
  return { backgroundColor: color, border: `2px solid ${color}`, color: '#fff', opacity: done ? 0.5 : 1 }
}

const EntryView = ({ event }: { event: Entry }) => {
  const { Icon } = PLATFORM_STYLE[event.platform]
  return (
    <span className="flex items-center gap-1 min-w-0">
      <Icon className="shrink-0" />
      <span className="truncate">{event.title}</span>
    </span>
  )
}

// When the website change runs: its own time, or the lead time before the first message
const websiteRunAt = (post: Post, leadMinutes: number) => {
  const change = post.websiteChange
  if (!change) return null
  if (change.runAt) return new Date(change.runAt)
  const times = post.targets
    .filter((t) => t.status !== 'cancelled')
    .map((t) => t.sendAt ?? post.sendAt)
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime())
  return times.length ? new Date(Math.min(...times) - leadMinutes * 60_000) : null
}

// Every message and website change of the posts at its time
const toEntries = (posts: Post[], channels: Channel[], leadMinutes: number): Entry[] =>
  posts
    .filter((p) => p.status !== 'cancelled')
    .flatMap((post) => {
      const name = `${PREFIX[post.status] ?? ''}${post.title || `Post #${post.id}`}`
      const entry = (title: string, platform: Entry['platform'], start: Date, done: boolean): Entry => ({
        title,
        start,
        end: new Date(start.getTime() + 30 * 60_000),
        postId: post.id,
        status: post.status,
        platform,
        done,
      })
      const entries: Entry[] = post.targets.flatMap((t) => {
        const time = t.sendAt ?? post.sendAt
        const channel = channels.find((c) => c.id === t.channelId)
        if (!time || !channel || t.status === 'cancelled') return []
        return [entry(`${channel.name}: ${name}`, channel.platform, new Date(time), t.status === 'sent')]
      })
      const run = websiteRunAt(post, leadMinutes)
      if (run) entries.push(entry(name, 'website', run, post.websiteChange?.status === 'done'))
      return entries
    })

type Props = { posts: Post[]; channels: Channel[]; leadMinutes: number; onOpen: (id: string) => void }

const PostCalendar = ({ posts, channels, leadMinutes, onOpen }: Props) => {
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4 text-sm">
        {(['telegram', 'instagram', 'discord', 'website'] as const).map((platform) => {
          const { color, Icon } = PLATFORM_STYLE[platform]
          return (
            <span key={platform} className="flex items-center gap-1 capitalize" style={{ color }}>
              <Icon /> {platform}
            </span>
          )
        })}
        <span className="px-2 rounded-sm bg-gray-500 text-white">Approved</span>
        <span className="px-2 rounded-sm border-2 border-gray-500 bg-white">⏳ Awaiting approval</span>
        <span className="px-2 rounded-sm border-2 border-dashed border-gray-500 bg-white italic">
          DRAFT · not scheduled
        </span>
        <span className="px-2 rounded-sm bg-gray-500 text-white opacity-50">Sent</span>
      </div>
      <div className="h-[700px] text-base bg-white">
        <BigCalendar
          localizer={localizer}
          events={toEntries(posts, channels, leadMinutes)}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={['month', 'week', 'agenda']}
          onSelectEvent={(e: Entry) => onOpen(e.postId)}
          eventPropGetter={(e: Entry) => ({ style: entryStyle(e) })}
          components={{ event: EntryView }}
        />
      </div>
    </div>
  )
}

export default PostCalendar
