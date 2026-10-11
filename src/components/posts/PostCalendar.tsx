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
  // The platforms of the messages sent at the same time, or the website
  platforms: (Platform | 'website')[]
  done: boolean
}

// Drafts and posts awaiting approval are shown, but clearly not scheduled
const PREFIX: Partial<Record<PostStatus, string>> = { draft: 'DRAFT · ', awaiting_approval: '⏳ ' }

// In the platforms' colours: filled when approved, outlined when not
const entryStyle = ({ status, done, platforms }: Entry): CSSProperties => {
  const colors = platforms.map((p) => PLATFORM_STYLE[p].color)
  const color = colors[0]
  if (status === 'draft') {
    return { backgroundColor: '#fff', border: `2px dashed ${color}`, color, fontStyle: 'italic' }
  }
  if (status === 'awaiting_approval') {
    return { backgroundColor: '#fff', border: `2px solid ${color}`, color }
  }
  return {
    background: colors.length > 1 ? `linear-gradient(90deg, ${colors.join(', ')})` : color,
    border: `2px solid ${color}`,
    color: '#fff',
    opacity: done ? 0.5 : 1,
  }
}

const EntryView = ({ event }: { event: Entry }) => (
  <span className="flex items-center gap-1 min-w-0">
    {event.platforms.map((platform) => {
      const { Icon } = PLATFORM_STYLE[platform]
      return <Icon key={platform} className="shrink-0" />
    })}
    <span className="truncate">{event.title}</span>
  </span>
)

// When the website change runs: when the post was approved, its own time, or the
// lead time before the first message
const websiteRunAt = (post: Post, leadMinutes: number) => {
  const change = post.websiteChange
  if (!change) return null
  if (change.ranAt) return new Date(change.ranAt)
  if (change.timing === 'on_approval') {
    const approved = post.status === 'scheduled' || post.status === 'done'
    return approved && post.approvedAt ? new Date(post.approvedAt) : null
  }
  if (change.timing === 'at') return change.runAt ? new Date(change.runAt) : null
  const times = post.targets
    .filter((t) => t.status !== 'cancelled')
    .map((t) => t.sendAt ?? post.sendAt)
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime())
  return times.length ? new Date(Math.min(...times) - leadMinutes * 60_000) : null
}

// The messages and website change of the posts at their times. Messages sent at
// the same time are one entry.
const toEntries = (posts: Post[], channels: Channel[], leadMinutes: number): Entry[] =>
  posts
    .filter((p) => p.status !== 'cancelled')
    .flatMap((post) => {
      const name = `${PREFIX[post.status] ?? ''}${post.title || 'Untitled post'}`
      const entry = (title: string, platforms: Entry['platforms'], start: Date, done: boolean): Entry => ({
        title,
        start,
        end: new Date(start.getTime() + 30 * 60_000),
        postId: post.id,
        status: post.status,
        platforms,
        done,
      })
      const byTime = new Map<number, { channel: Channel; sent: boolean }[]>()
      for (const t of post.targets) {
        const time = t.sendAt ?? post.sendAt
        const channel = channels.find((c) => c.id === t.channelId)
        if (!time || !channel || t.status === 'cancelled') continue
        const key = new Date(time).getTime()
        byTime.set(key, [...(byTime.get(key) ?? []), { channel, sent: t.status === 'sent' }])
      }
      const entries: Entry[] = [...byTime].map(([time, messages]) =>
        entry(
          `${messages.map((m) => m.channel.name).join(', ')}: ${name}`,
          [...new Set(messages.map((m) => m.channel.platform))],
          new Date(time),
          messages.every((m) => m.sent)
        )
      )
      const run = websiteRunAt(post, leadMinutes)
      if (run) entries.push(entry(name, ['website'], run, post.websiteChange?.status === 'done'))
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
