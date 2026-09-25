import moment, { Moment } from 'moment'
import { ReactNode, useState } from 'react'
import { FaChevronDown, FaMapMarkerAlt, FaRegCalendar, FaRegClock } from 'react-icons/fa'
import { AGEvent, EventSession } from '../types/types'
import {
  eventMoment,
  formatSignupTime,
  getSignupStatus,
  getSignupTargets,
  SignupTarget,
} from '../utils/eventUtils'
import { SignupSummary } from '../utils/signupApi'
import { poolFill, totalFill } from '../utils/signupPools'
import { useNow } from '../utils/useNow'
import CapacityBar from './CapacityBar'
import SignupStatusTag from './SignupStatusTag'

// Upcoming dates shown before "Show all"
const VISIBLE_UPCOMING = 3

type Props = {
  event: AGEvent
  // Sign-up forms by target key, for sessions that have one
  summaries: Record<string, SignupSummary>
  selectedSignupKey: string | null
  onSelectSignup: (key: string) => void
  // Opens the sign-up form
  onSignUp: (key: string) => void
  isSignedUp: (key: string) => boolean
}

// Same accent as the red bars under headers
const Card = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col bg-darkgray border-l-4 border-red px-6 py-5">{children}</div>
)

const Label = ({ children }: { children: ReactNode }) => (
  <div className="uppercase tracking-widest text-sm mb-1">{children}</div>
)

const Detail = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <div className="flex gap-3 items-center text-lightgray">
    <span className="shrink-0 text-base">{icon}</span>
    <span>{children}</span>
  </div>
)

const getDateAndTime = ({ start, end }: EventSession) => {
  const startMoment = eventMoment(start)
  const endMoment = eventMoment(end)
  if (!endMoment.isAfter(startMoment)) {
    return { date: startMoment.format('ddd D.M.YYYY'), time: startMoment.format('HH:mm') }
  }
  const time = `${startMoment.format('HH:mm')}–${endMoment.format('HH:mm')}`
  if (startMoment.isSame(endMoment, 'day')) {
    return { date: startMoment.format('ddd D.M.YYYY'), time }
  }
  return {
    date: `${startMoment.format('ddd D.M.')} – ${endMoment.format('ddd D.M.YYYY')}`,
    time,
  }
}

export const scrollToSignups = () =>
  document.getElementById('signups')?.scrollIntoView({ behavior: 'smooth' })

const SignupPanel = ({
  target,
  summary,
  now,
  isSignedUp,
  onSelect,
  onSignUp,
  standalone = false,
}: {
  target: SignupTarget
  summary: SignupSummary
  now: Moment | null
  isSignedUp: boolean
  onSelect: (key: string) => void
  onSignUp: (key: string) => void
  // On its own card, which already has a heading, rather than under a session
  standalone?: boolean
}) => {
  const status = now && getSignupStatus(summary, now)
  const { pools, counts } = summary
  const statusText =
    status === 'notOpen'
      ? `Opens ${formatSignupTime(moment(summary.openfrom))}`
      : status === 'closed'
        ? `Closed ${formatSignupTime(moment(summary.openuntil))}`
        : status === 'open'
          ? `Open until ${formatSignupTime(moment(summary.openuntil))}`
          : ''

  return (
    <div
      className={`flex flex-col gap-3 ${standalone ? 'mt-3' : 'border-t border-gray-600 mt-4 pt-4'}`}
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-center justify-between">
        <div className="uppercase tracking-widest text-sm text-lightgray">Sign-up</div>
        {now && <SignupStatusTag summary={summary} now={now} />}
      </div>
      {pools.map((pool) => {
        const { taken, reserve } = poolFill(pool, counts[pool.id] ?? 0)
        return (
          <CapacityBar
            key={pool.id}
            label={pools.length > 1 ? `${pool.name}${pool.private ? ' (private)' : ''}` : undefined}
            taken={taken}
            size={pool.size}
            reserve={reserve}
          />
        )
      })}
      <div className="text-base text-lightgray">{statusText}</div>
      {status === 'open' && (
        <button
          type="button"
          className={`${isSignedUp ? 'borderbutton' : 'mainbutton'} !text-lg !py-2 !px-6`}
          onClick={() => {
            onSelect(target.key)
            onSignUp(target.key)
          }}
        >
          {isSignedUp ? 'Edit sign-up' : 'Sign up'}
        </button>
      )}
    </div>
  )
}

const SessionCard = ({ session, children }: { session: EventSession; children?: ReactNode }) => {
  const { date, time } = getDateAndTime(session)
  return (
    <Card>
      {session.name && <Label>{session.name}</Label>}
      <div className="flex gap-3 items-center mb-2">
        <FaRegCalendar className="shrink-0 text-base text-lightgray" />
        <span className="text-2xl">{date}</span>
      </div>
      <div className="flex flex-col gap-1">
        <Detail icon={<FaRegClock />}>{time}</Detail>
        {session.location && <Detail icon={<FaMapMarkerAlt />}>{session.location}</Detail>}
      </div>
      {children}
    </Card>
  )
}

/** A collapsed session, opened into a card by clicking it */
const SessionRow = ({
  session,
  summary,
  now,
  isPast,
  onClick,
}: {
  session: EventSession
  summary?: SignupSummary
  now: Moment | null
  isPast: boolean
  onClick: () => void
}) => {
  const start = eventMoment(session.start)
  const fill = summary && totalFill(summary.pools, summary.counts)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-4 bg-darkgray border-l-4 border-gray-600 hover:border-red px-4 py-3 text-left transition-colors ${
        isPast ? 'text-lightgray' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="text-lg">
          {start.format('ddd D.M.')}
          <span className="text-lightgray whitespace-nowrap">
            {' '}
            · {getDateAndTime(session).time}
          </span>
        </div>
        {(session.name || session.location) && (
          <div className="text-base text-lightgray truncate">
            {[session.name, session.location].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {summary && now && (
          <div className="flex flex-col items-end gap-1.5">
            <SignupStatusTag summary={summary} now={now} />
            {fill && fill.size > 0 && (
              <div className="w-20">
                <CapacityBar taken={fill.taken} size={fill.size} compact />
              </div>
            )}
          </div>
        )}
        <FaChevronDown className="text-lightgray" size={12} />
      </div>
    </button>
  )
}

/** Times, places and sign-ups of an event, shown next to its image */
const EventDetails = ({
  event,
  summaries,
  selectedSignupKey,
  onSelectSignup,
  onSignUp,
  isSignedUp,
}: Props) => {
  const now = useNow()
  const [expandedStart, setExpandedStart] = useState<string | null>(null)
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const targets = getSignupTargets(event)
  const { sessions } = event

  const sessionTarget = (session: EventSession) =>
    targets.find((t) => t.session === session && summaries[t.key])
  const eventTarget = targets.find((t) => !t.session && summaries[t.key])

  const signupPanel = (target: SignupTarget, standalone = false) => (
    <SignupPanel
      target={target}
      summary={summaries[target.key]}
      now={now}
      isSignedUp={isSignedUp(target.key)}
      onSelect={onSelectSignup}
      onSignUp={onSignUp}
      standalone={standalone}
    />
  )

  const eventSignupCard = eventTarget && (
    <Card>
      <Label>Sign-up</Label>
      <div className="text-2xl">
        {sessions.length > 1 ? 'One sign-up for all dates' : 'Sign up for the event'}
      </div>
      {signupPanel(eventTarget, true)}
    </Card>
  )

  if (!sessions.length) {
    return (
      <div className="flex flex-col gap-4 text-lg text-left">
        <Card>
          <div className="text-2xl">Time and place to be announced</div>
        </Card>
        {eventSignupCard}
      </div>
    )
  }

  if (sessions.length === 1) {
    const [session] = sessions
    const target = sessionTarget(session) ?? eventTarget
    return (
      <div className="flex flex-col gap-4 text-lg text-left">
        <SessionCard session={session}>{target && signupPanel(target)}</SessionCard>
      </div>
    )
  }

  // Which sessions are past is only known in the browser
  if (!now) return <div className="min-h-48" />

  const isPast = (session: EventSession) => eventMoment(session.end).isBefore(now)
  const upcoming = sessions.filter((s) => !isPast(s))
  const past = sessions.filter(isPast).reverse()

  const selectedSession = targets.find((t) => t.key === selectedSignupKey)?.session
  const expanded =
    sessions.find((s) => s.start === expandedStart) ?? selectedSession ?? upcoming[0] ?? null

  const expand = (session: EventSession) => {
    setExpandedStart(session.start)
    const target = sessionTarget(session)
    if (target) onSelectSignup(target.key)
  }

  const renderSession = (session: EventSession) => {
    const target = sessionTarget(session)
    if (session === expanded) {
      return (
        <SessionCard session={session} key={session.start}>
          {target && signupPanel(target)}
        </SessionCard>
      )
    }
    return (
      <SessionRow
        key={session.start}
        session={session}
        summary={target && summaries[target.key]}
        now={now}
        isPast={isPast(session)}
        onClick={() => expand(session)}
      />
    )
  }

  const visibleUpcoming = showAllUpcoming
    ? upcoming
    : upcoming.filter((s, i) => i < VISIBLE_UPCOMING || s === expanded)
  const hiddenCount = upcoming.length - visibleUpcoming.length

  return (
    <div className="flex flex-col gap-2 text-lg text-left">
      {!upcoming.length && (
        <Card>
          <div className="text-2xl">No upcoming dates</div>
        </Card>
      )}
      {visibleUpcoming.map(renderSession)}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="self-start uppercase tracking-widest text-sm text-lightgray hover:text-red py-2"
          onClick={() => setShowAllUpcoming(true)}
        >
          Show all {upcoming.length} upcoming dates
        </button>
      )}
      {eventSignupCard && <div className="mt-2">{eventSignupCard}</div>}
      {past.length > 0 && (
        <details className="mt-2" open={!!expanded && isPast(expanded)}>
          <summary className="cursor-pointer uppercase tracking-widest text-sm text-lightgray hover:text-red py-2">
            Past dates ({past.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">{past.map(renderSession)}</div>
        </details>
      )}
    </div>
  )
}

export default EventDetails
