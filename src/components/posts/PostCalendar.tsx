import { Calendar as BigCalendar, momentLocalizer, type View } from 'react-big-calendar'
import moment from 'moment'
import { type CSSProperties, useEffect, useState } from 'react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import type { AGEvent } from '../../types/types'
import type { Channel, Platform, Post, PostStatus } from '../../utils/social/types'
import { DEFAULT_EVENT_IMAGE } from '../../utils/eventUtils'
import { imageLoader } from '../AGImage'
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
  color: string
}

// Drafts and posts awaiting approval are shown, but clearly not scheduled
const PREFIX: Partial<Record<PostStatus, string>> = { draft: 'DRAFT · ', awaiting_approval: '⏳ ' }

// Colours for the posts of events without a (colourful) image, and posts without an event
const PALETTE = [
  '#2563EB',
  '#DC2626',
  '#059669',
  '#D97706',
  '#7C3AED',
  '#DB2777',
  '#0891B2',
  '#65A30D',
]

const paletteColor = (key: string) => {
  let hash = 0
  for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

// The most used colour of an image: the colourful pixels are grouped by hue and
// the pixels of the biggest group (with its neighbours) averaged. Saturated and
// darkened enough for white text. Fails for images that are mostly grey.
const HUE_BINS = 24
const dominantColor = (src: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const size = 32
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No canvas'))
      ctx.drawImage(img, 0, 0, size, size)
      const data = ctx.getImageData(0, 0, size, size).data
      const bins = Array.from({ length: HUE_BINS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }))
      let pixels = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue
        pixels++
        const [h, sat, l] = toHsl(data[i], data[i + 1], data[i + 2])
        // Greys, near-black and near-white don't count
        if (sat < 0.2 || l < 0.12 || l > 0.9) continue
        const bin = bins[Math.floor(h / (360 / HUE_BINS)) % HUE_BINS]
        bin.weight += sat
        bin.r += data[i] * sat
        bin.g += data[i + 1] * sat
        bin.b += data[i + 2] * sat
      }
      const around = (i: number) => [-1, 0, 1].map((d) => bins[(i + d + HUE_BINS) % HUE_BINS])
      const score = (i: number) => {
        const [prev, bin, next] = around(i)
        return prev.weight / 2 + bin.weight + next.weight / 2
      }
      const best = bins.reduce((best, _, i) => (score(i) > score(best) ? i : best), 0)
      const group = around(best)
      const weight = group.reduce((sum, bin) => sum + bin.weight, 0)
      if (!pixels || weight < pixels * 0.03) return reject(new Error('No clear colour'))
      const sum = (key: 'r' | 'g' | 'b') => group.reduce((s, bin) => s + bin[key], 0) / weight
      const [h, sat, l] = toHsl(sum('r'), sum('g'), sum('b'))
      resolve(
        `hsl(${Math.round(h)} ${Math.round(Math.max(sat, 0.45) * 100)}% ${Math.round(Math.min(Math.max(l, 0.3), 0.45) * 100)}%)`
      )
    }
    img.onerror = reject
    img.src = imageLoader({ src, width: 64 })
  })

const toHsl = (r: number, g: number, b: number): [number, number, number] => {
  ;[r, g, b] = [r / 255, g / 255, b / 255]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return [0, 0, l]
  const sat = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, sat, l]
}

// The colours of the events by slug, from their images
const useEventColors = (events: AGEvent[]) => {
  const [colors, setColors] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    for (const event of events) {
      if (!event.image || event.image === DEFAULT_EVENT_IMAGE) continue
      dominantColor(event.image)
        .then((color) => !cancelled && setColors((c) => ({ ...c, [event.slug]: color })))
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [events])
  return colors
}

// In the event's colour: filled when approved, outlined when not
const entryStyle = ({ status, done, color }: Entry): CSSProperties => {
  if (status === 'draft') {
    return { backgroundColor: '#fff', border: `2px dashed ${color}`, color, fontStyle: 'italic' }
  }
  if (status === 'awaiting_approval') {
    return { backgroundColor: '#fff', border: `2px solid ${color}`, color }
  }
  return {
    backgroundColor: color,
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
const toEntries = (
  posts: Post[],
  channels: Channel[],
  events: AGEvent[],
  eventColors: Record<string, string>,
  leadMinutes: number
): Entry[] =>
  posts
    .filter((p) => p.status !== 'cancelled')
    .flatMap((post) => {
      const event = events.find((e) => e.slug === post.eventSlug)
      const color = (event && eventColors[event.slug]) ?? paletteColor(post.eventSlug ?? post.id)
      const name = `${PREFIX[post.status] ?? ''}${post.title || 'Untitled post'}${event ? ` (${event.name})` : ''}`
      const entry = (
        title: string,
        platforms: Entry['platforms'],
        start: Date,
        done: boolean
      ): Entry => ({
        title,
        start,
        end: new Date(start.getTime() + 30 * 60_000),
        postId: post.id,
        status: post.status,
        platforms,
        done,
        color,
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
          name,
          [...new Set(messages.map((m) => m.channel.platform))],
          new Date(time),
          messages.every((m) => m.sent)
        )
      )
      const run = websiteRunAt(post, leadMinutes)
      if (run) entries.push(entry(name, ['website'], run, post.websiteChange?.status === 'done'))
      return entries
    })

type Props = {
  posts: Post[]
  channels: Channel[]
  events: AGEvent[]
  leadMinutes: number
  onOpen: (id: string) => void
  onCreate: (sendAt: Date) => void
}

// A new post on a day of the month view is sent at noon, in the week view at the clicked time
const createAt = (start: Date, view: View) =>
  view === 'month' ? moment(start).hour(12).minute(0).toDate() : start

const PostCalendar = ({ posts, channels, events, leadMinutes, onOpen, onCreate }: Props) => {
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  const eventColors = useEventColors(events)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4 text-sm">
        {(['telegram', 'instagram', 'discord', 'website'] as const).map((platform) => {
          const { Icon } = PLATFORM_STYLE[platform]
          return (
            <span key={platform} className="flex items-center gap-1 capitalize">
              <Icon /> {platform}
            </span>
          )
        })}
        <span className="px-2 rounded-sm bg-gray-500 text-white">Approved</span>
        <span className="px-2 rounded-sm border-2 border-gray-500 bg-white">
          ⏳ Awaiting approval
        </span>
        <span className="px-2 rounded-sm border-2 border-dashed border-gray-500 bg-white italic">
          Draft
        </span>
        <span className="px-2 rounded-sm bg-gray-500 text-white opacity-50">Sent</span>
      </div>
      <div className="h-[700px] text-base bg-white">
        <BigCalendar
          localizer={localizer}
          events={toEntries(posts, channels, events, eventColors, leadMinutes)}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={['month', 'week', 'agenda']}
          onSelectEvent={(e: Entry) => onOpen(e.postId)}
          selectable
          onSelectSlot={({ start }) => onCreate(createAt(start, view))}
          onDrillDown={(day) => onCreate(createAt(day, 'month'))}
          eventPropGetter={(e: Entry) => ({ style: entryStyle(e) })}
          components={{ event: EntryView }}
        />
      </div>
    </div>
  )
}

export default PostCalendar
