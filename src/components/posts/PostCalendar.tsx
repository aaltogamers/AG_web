import { Calendar as BigCalendar, momentLocalizer, type View } from 'react-big-calendar'
import moment from 'moment'
import { type CSSProperties, useState } from 'react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import type { Channel, Post, PostStatus } from '../../utils/social/types'
import styles from '../Calendar.module.css'

// Weeks start on Monday, like the events calendar
moment.locale('en-GB', { week: { dow: 1, doy: 1 } })
const localizer = momentLocalizer(moment)

type Entry = { title: string; start: Date; end: Date; postId: string; status: PostStatus; done: boolean }

const SHORT = { telegram: 'TG', discord: 'DC', instagram: 'IG' } as const

// Drafts and posts awaiting approval are shown, but clearly not scheduled
const PREFIX: Partial<Record<PostStatus, string>> = { draft: 'DRAFT · ', awaiting_approval: '⏳ ' }

const entryStyle = ({ status, done }: Entry): CSSProperties => {
  if (status === 'draft') {
    return { backgroundColor: 'transparent', border: '2px dashed #AAABAD', color: '#AAABAD', fontStyle: 'italic' }
  }
  if (status === 'awaiting_approval') {
    return { backgroundColor: 'transparent', border: '2px solid #facc15', color: '#facc15' }
  }
  return { opacity: done ? 0.5 : 1 }
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
      const entry = (title: string, start: Date, done: boolean): Entry => ({
        title,
        start,
        end: new Date(start.getTime() + 30 * 60_000),
        postId: post.id,
        status: post.status,
        done,
      })
      const entries: Entry[] = post.targets.flatMap((t) => {
        const time = t.sendAt ?? post.sendAt
        const channel = channels.find((c) => c.id === t.channelId)
        if (!time || t.status === 'cancelled') return []
        const label = channel ? `${SHORT[channel.platform]} ${channel.name}` : '?'
        return [entry(`${label}: ${name}`, new Date(time), t.status === 'sent')]
      })
      const run = websiteRunAt(post, leadMinutes)
      if (run) entries.push(entry(`🌐 ${name}`, run, post.websiteChange?.status === 'done'))
      return entries
    })

type Props = { posts: Post[]; channels: Channel[]; leadMinutes: number; onOpen: (id: string) => void }

const PostCalendar = ({ posts, channels, leadMinutes, onOpen }: Props) => {
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="px-2 rounded-sm bg-red">Approved</span>
        <span className="px-2 rounded-sm border-2 border-yellow-400 text-yellow-400">⏳ Awaiting approval</span>
        <span className="px-2 rounded-sm border-2 border-dashed border-lightgray text-lightgray italic">
          DRAFT · not scheduled
        </span>
        <span className="px-2 rounded-sm bg-red opacity-50">Sent</span>
      </div>
      <div className={`${styles.calendarWrapper} h-[700px] text-base`}>
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
        />
      </div>
    </div>
  )
}

export default PostCalendar
