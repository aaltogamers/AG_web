import { Calendar as BigCalendar, momentLocalizer, type View } from 'react-big-calendar'
import moment from 'moment'
import { cloneElement, createContext, type CSSProperties, useContext, useEffect, useState } from 'react'
import type { DateCellWrapperProps, DateHeaderProps, HeaderProps } from 'react-big-calendar'
import { FaCalendarDay, FaClipboardList, FaPlus } from 'react-icons/fa'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import type { AGEvent } from '../../types/types'
import type { Channel, Platform, Post, PostStatus } from '../../utils/social/types'
import { DEFAULT_EVENT_IMAGE, eventMoment, getSignupTargetLabel, getSignupTargets } from '../../utils/eventUtils'
import type { SignupEvent } from '../../utils/signupApi'
import { imageLoader } from '../AGImage'
import { PLATFORM_STYLE } from './ChannelChip'

// Weeks start on Monday, like the events calendar
moment.locale('en-GB', { week: { dow: 1, doy: 1 } })
const localizer = momentLocalizer(moment)

type Entry = {
  kind: 'post'
  title: string
  start: Date
  end: Date
  postId: string
  status: PostStatus
  // The platforms of the messages sent at the same time, or the website
  platforms: (Platform | 'website')[]
  done: boolean
  color: string
  // A post sent as soon as it's approved has no time yet, so it's shown for today
  allDay?: boolean
}

// A session of an event, or a sign-up opening or closing
type OtherEntry = {
  kind: 'event' | 'signup'
  title: string
  start: Date
  end: Date
  color: string
  eventSlug: string
  // The sign-up form's key
  signupKey?: string
  allDay?: boolean
}

type CalendarEntry = Entry | OtherEntry

// Posts awaiting approval are shown, but clearly not scheduled (drafts by their dashed border)
const PREFIX: Partial<Record<PostStatus, string>> = { awaiting_approval: '⏳ ' }

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

// Posts in the event's colour: filled when approved, outlined when not. Events are tinted
// with a thick left border, sign-ups dotted.
const entryStyle = (entry: CalendarEntry): CSSProperties => {
  if (entry.kind !== 'post') {
    return entry.kind === 'event'
      ? {
          backgroundColor: `color-mix(in srgb, ${entry.color} 18%, white)`,
          border: 'none',
          borderLeft: `5px solid ${entry.color}`,
          color: '#111',
          fontWeight: 'bold',
        }
      : { backgroundColor: '#fff', border: `2px dotted ${entry.color}`, color: entry.color }
  }
  const { status, done, color } = entry
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

const EntryView = ({ event }: { event: CalendarEntry }) => (
  <span className="flex items-center gap-1 min-w-0">
    {event.kind !== 'post' ? (
      event.kind === 'event' ? (
        <FaCalendarDay className="shrink-0" />
      ) : (
        <FaClipboardList className="shrink-0" />
      )
    ) : (
      event.platforms.map((platform) => {
        const { Icon } = PLATFORM_STYLE[platform]
        return <Icon key={platform} className="shrink-0" />
      })
    )}
    <span className="truncate">{event.title}</span>
  </span>
)

// Moments like a message or a sign-up opening are shown 30 minutes long, but not past
// midnight, so that one late in the evening isn't shown on the next day too
const shortEnd = (start: Date) =>
  new Date(Math.min(start.getTime() + 30 * 60_000, moment(start).endOf('day').valueOf()))

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
      const today = moment().startOf('day').toDate()
      const onApproval = post.sendOnApproval && !post.sendAt
      const entry = (
        title: string,
        platforms: Entry['platforms'],
        start: Date,
        done: boolean
      ): Entry => {
        const allDay = onApproval && start.getTime() === today.getTime()
        return {
          kind: 'post',
          title,
          start,
          end: allDay ? start : shortEnd(start),
          postId: post.id,
          status: post.status,
          platforms,
          done,
          color,
          allDay,
        }
      }
      const byTime = new Map<number, { channel: Channel; sent: boolean }[]>()
      for (const t of post.targets) {
        const time = t.sendAt ?? post.sendAt ?? (onApproval ? today.toISOString() : null)
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
      const run =
        websiteRunAt(post, leadMinutes) ??
        (onApproval && post.websiteChange && !post.websiteChange.ranAt ? today : null)
      if (run) {
        const websiteDone = post.websiteChange?.status === 'done'
        // A website change shortly before messages (like the lead time) is part of their entry
        const time = run.getTime()
        const messages = entries.find(
          (e) => e.start.getTime() >= time && e.start.getTime() - time <= leadMinutes * 60_000
        )
        if (messages) {
          messages.platforms = ['website', ...messages.platforms]
          messages.done = messages.done && websiteDone
        } else entries.push(entry(name, ['website'], run, websiteDone))
      }
      return entries
    })

const eventColor = (slug: string, eventColors: Record<string, string>) => eventColors[slug] ?? paletteColor(slug)

// The sessions of the events
const toEventEntries = (events: AGEvent[], eventColors: Record<string, string>): OtherEntry[] =>
  events.flatMap((event) =>
    event.sessions.map((session) => {
      const start = eventMoment(session.start).toDate()
      const end = eventMoment(session.end).toDate()
      return {
        kind: 'event' as const,
        title: session.name ? `${event.name}: ${session.name}` : event.name,
        start,
        end: end > start ? end : new Date(start.getTime() + 60 * 60_000),
        color: eventColor(event.slug, eventColors),
        eventSlug: event.slug,
      }
    })
  )

// When the sign-up forms open and close
const toSignupEntries = (
  forms: SignupEvent[],
  events: AGEvent[],
  eventColors: Record<string, string>
): OtherEntry[] => {
  const targets = events.flatMap(getSignupTargets)
  return forms.flatMap((form) => {
    const target = targets.find((t) => t.key === form.key)
    if (!target) return []
    const label = getSignupTargetLabel(target)
    const entry = (what: string, time: string): OtherEntry => {
      const start = new Date(time)
      return {
        kind: 'signup',
        title: `Sign-up ${what}: ${label}`,
        start,
        end: shortEnd(start),
        color: eventColor(target.event.slug, eventColors),
        eventSlug: target.event.slug,
        signupKey: form.key,
      }
    }
    return [entry('opens', form.openfrom), entry('closes', form.openuntil)]
  })
}

// The day under the mouse in the month view, so its "+ Post" button is shown
const HoveredDay = createContext<{
  day: number | null
  // Only the week view's day header uses this; clicks on days go to onSelectSlot
  onCreate: (day: Date) => void
}>({ day: null, onCreate: () => {} })

// Only a hint: clicking anywhere on the day (or the week view's day header) makes the post.
// Looks like a calendar entry, as if the new post was already there.
const NewPostEntry = ({ className = '' }: { className?: string }) => (
  <span
    className={`flex items-center gap-1.5 rounded-[5px] px-[5px] py-[2px] border-2 border-dashed border-red/70 bg-red/10 text-red text-sm pointer-events-none ${className}`}
  >
    <FaPlus size={10} className="shrink-0" />
    <span className="truncate">New post</span>
  </span>
)

// Marks the day's background with its day, for finding the hovered day (hoveredDayAt)
const DayCell = ({ value, children }: DateCellWrapperProps) =>
  cloneElement(children, { 'data-day': moment(value).startOf('day').valueOf() })

// The day under the mouse in the month view, also when it's over an entry (which are on
// a layer above the days' backgrounds and can span many days)
const hoveredDayAt = (e: MouseEvent) => {
  const row = (e.target as Element).closest('.rbc-month-row')
  const cells = row ? [...row.querySelectorAll<HTMLElement>('[data-day]')] : []
  const cell = cells.find((c) => {
    const { left, right } = c.getBoundingClientRect()
    return e.clientX >= left && e.clientX < right
  })
  return cell ? Number(cell.dataset.day) : null
}

// Clicks on the header go to the calendar's slot selection, like clicks on the rest of the day
const MonthDateHeader = ({ date, label }: DateHeaderProps) => {
  const { day } = useContext(HoveredDay)
  const key = moment(date).startOf('day').valueOf()
  return (
    <div className="flex items-center justify-between gap-1 cursor-pointer">
      <NewPostEntry className={`flex-1 min-w-0 ${day === key ? '' : 'invisible'}`} />
      <span>{label}</span>
    </div>
  )
}

const WeekHeader = ({ date, label }: HeaderProps) => {
  const { onCreate } = useContext(HoveredDay)
  return (
    <div className="group flex flex-col items-center gap-0.5 cursor-pointer" onClick={() => onCreate(date)}>
      <span>{label}</span>
      <NewPostEntry className="w-full opacity-0 group-hover:opacity-100" />
    </div>
  )
}

type Props = {
  posts: Post[]
  channels: Channel[]
  events: AGEvent[]
  signupForms: SignupEvent[]
  leadMinutes: number
  onOpen: (id: string) => void
  onCreate: (sendAt: Date) => void
  onOpenEvent: (slug: string) => void
  onOpenSignup: (slug: string, key: string) => void
}

// A new post on a day is sent at noon, in the week view at the clicked time
const atNoon = (day: Date) => moment(day).hour(12).minute(0).toDate()

const SHOWN_KINDS = { posts: 'Posts', event: 'Events', signup: 'Sign-ups' } as const
type ShownKind = keyof typeof SHOWN_KINDS

const PostCalendar = ({
  posts,
  channels,
  events,
  signupForms,
  leadMinutes,
  onOpen,
  onCreate,
  onOpenEvent,
  onOpenSignup,
}: Props) => {
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const [shown, setShown] = useState<Record<ShownKind, boolean>>({ posts: true, event: true, signup: true })
  const eventColors = useEventColors(events)
  const entries: CalendarEntry[] = [
    ...(shown.event ? toEventEntries(events, eventColors) : []),
    ...(shown.signup ? toSignupEntries(signupForms, events, eventColors) : []),
    ...(shown.posts ? toEntries(posts, channels, events, eventColors, leadMinutes) : []),
  ]
  const open = (entry: CalendarEntry) => {
    if (entry.kind === 'post') onOpen(entry.postId)
    else if (entry.signupKey) onOpenSignup(entry.eventSlug, entry.signupKey)
    else onOpenEvent(entry.eventSlug)
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4 text-sm">
        {(Object.keys(SHOWN_KINDS) as ShownKind[]).map((kind) => (
          <label key={kind} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={shown[kind]}
              onChange={(e) => setShown((s) => ({ ...s, [kind]: e.target.checked }))}
            />
            {SHOWN_KINDS[kind]}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <span
          className="flex items-center gap-1 px-2 rounded-sm font-bold"
          style={{ backgroundColor: '#e5e7eb', borderLeft: '5px solid #6b7280' }}
        >
          <FaCalendarDay /> Event
        </span>
        <span className="flex items-center gap-1 px-2 rounded-sm border-2 border-dotted border-gray-500 bg-white">
          <FaClipboardList /> Sign-up opens / closes
        </span>
        {(['telegram', 'instagram', 'discord'] as const).map((platform) => {
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
      <HoveredDay.Provider value={{ day: hoveredDay, onCreate: (day) => onCreate(atNoon(day)) }}>
        <div
          // Tall enough in the month view for a day to show at least three entries before "+N more"
          className={`${view === 'month' ? 'h-[900px]' : 'h-[700px]'} text-sm bg-white [&_.rbc-month-view_.rbc-day-bg]:cursor-pointer`}
          onMouseMove={(e) => setHoveredDay(hoveredDayAt(e.nativeEvent))}
          onMouseLeave={() => setHoveredDay(null)}
        >
          <BigCalendar
            localizer={localizer}
            events={entries}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={['month', 'week', 'agenda']}
            onSelectEvent={open}
            // "+N more" opens the day's entries in a popup
            popup
            // Clicking a day makes a post at noon, in the week view at the clicked time
            selectable
            onSelectSlot={({ start, box }) => {
              // Clicks in the "+N more" popup reach the day below it too
              const clicked = box && document.elementFromPoint(box.clientX, box.clientY)
              if (clicked?.closest('.rbc-overlay')) return
              onCreate(view === 'month' ? atNoon(start) : start)
            }}
            eventPropGetter={(e: CalendarEntry) => ({ style: entryStyle(e) })}
            components={{
              event: EntryView,
              dateCellWrapper: DayCell,
              month: { dateHeader: MonthDateHeader },
              week: { header: WeekHeader },
            }}
          />
        </div>
      </HoveredDay.Provider>
    </div>
  )
}

export default PostCalendar
