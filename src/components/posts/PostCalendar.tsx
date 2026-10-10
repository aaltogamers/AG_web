import { Calendar as BigCalendar, momentLocalizer, type View } from 'react-big-calendar'
import moment from 'moment'
import { useState } from 'react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import type { Channel, Post } from '../../utils/social/types'
import styles from '../Calendar.module.css'

// Weeks start on Monday, like the events calendar
moment.locale('en-GB', { week: { dow: 1, doy: 1 } })
const localizer = momentLocalizer(moment)

type Entry = { title: string; start: Date; end: Date; postId: string; done: boolean }

const SHORT = { telegram: 'TG', discord: 'DC', instagram: 'IG' } as const

// Every message and website change of the posts at its time
const toEntries = (posts: Post[], channels: Channel[]): Entry[] =>
  posts
    .filter((p) => p.status !== 'cancelled')
    .flatMap((post) => {
      const name = post.title || `Post #${post.id}`
      const entries: Entry[] = post.targets.flatMap((t) => {
        const time = t.sendAt ?? post.sendAt
        const channel = channels.find((c) => c.id === t.channelId)
        if (!time || t.status === 'cancelled') return []
        const start = new Date(time)
        return [
          {
            title: `${channel ? `${SHORT[channel.platform]} ${channel.name}` : '?'}: ${name}`,
            start,
            end: new Date(start.getTime() + 30 * 60_000),
            postId: post.id,
            done: t.status === 'sent',
          },
        ]
      })
      const run = post.websiteChange?.runAt
      if (run) {
        const start = new Date(run)
        entries.push({
          title: `🌐 ${name}`,
          start,
          end: new Date(start.getTime() + 30 * 60_000),
          postId: post.id,
          done: post.websiteChange?.status === 'done',
        })
      }
      return entries
    })

type Props = { posts: Post[]; channels: Channel[]; onOpen: (id: string) => void }

const PostCalendar = ({ posts, channels, onOpen }: Props) => {
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  return (
    <div className={`${styles.calendarWrapper} h-[700px] text-base`}>
      <BigCalendar
        localizer={localizer}
        events={toEntries(posts, channels)}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        views={['month', 'week', 'agenda']}
        onSelectEvent={(e: Entry) => onOpen(e.postId)}
        eventPropGetter={(e: Entry) => ({ style: { opacity: e.done ? 0.5 : 1 } })}
      />
    </div>
  )
}

export default PostCalendar
