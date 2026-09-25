import moment, { Moment } from 'moment'
import { ReactNode } from 'react'
import { FaMapMarkerAlt, FaRegCalendar } from 'react-icons/fa'
import { AGEvent, EventSession } from '../types/types'
import {
  eventMoment,
  formatSessionTime,
  formatSignupTime,
  getSignupStatus,
  getSignupTargets,
  SignupTarget,
} from '../utils/eventUtils'
import { SignupSummary } from '../utils/signupApi'
import { poolFill } from '../utils/signupPools'
import { useNow } from '../utils/useNow'
import CapacityBar from './CapacityBar'
import SignupStatusTag from './SignupStatusTag'

type Props = {
  event: AGEvent
  // Sign-up forms by target key, for sessions that have one. Without them only the dates are shown.
  summaries?: Record<string, SignupSummary>
  // Opens the sign-up form
  onSignUp?: (key: string) => void
  isSignedUp?: (key: string) => boolean
}

const noop = () => {}

// Same accent as the red bars under headers
const Card = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col bg-darkgray border-l-4 border-red px-5 py-4">{children}</div>
)

const Label = ({ children }: { children: ReactNode }) => (
  <div className="uppercase tracking-widest text-sm mb-1">{children}</div>
)

const Detail = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <div className="flex gap-3 items-baseline text-lightgray">
    <span className="shrink-0 text-base relative top-0.5">{icon}</span>
    <span>{children}</span>
  </div>
)

export const scrollToSignups = () =>
  document.getElementById('signups')?.scrollIntoView({ behavior: 'smooth' })

const SignupPanel = ({
  target,
  summary,
  now,
  isSignedUp,
  onSignUp,
  standalone = false,
}: {
  target: SignupTarget
  summary: SignupSummary
  now: Moment | null
  isSignedUp: boolean
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
          onClick={() => onSignUp(target.key)}
        >
          {isSignedUp ? 'Edit sign-up' : 'Sign up'}
        </button>
      )}
    </div>
  )
}

const SessionCard = ({ session, children }: { session: EventSession; children?: ReactNode }) => (
  <Card>
    {session.name && <Label>{session.name}</Label>}
    <div className="flex flex-col gap-1">
      <div className="flex gap-3 items-baseline">
        <FaRegCalendar className="shrink-0 text-base text-lightgray relative top-0.5" />
        <span className="text-xl">{formatSessionTime(session)}</span>
      </div>
      {session.location && <Detail icon={<FaMapMarkerAlt />}>{session.location}</Detail>}
    </div>
    {children}
  </Card>
)

// Dates beyond this many are collapsed
const VISIBLE_DATES = 3

const Collapsed = ({ label, children }: { label: string; children: ReactNode }) => (
  <details className="mt-2">
    <summary className="cursor-pointer uppercase tracking-widest text-sm text-lightgray hover:text-red py-2">
      {label}
    </summary>
    <div className="mt-2 flex flex-col gap-2">{children}</div>
  </details>
)

/**
 * Times, places and sign-ups of an event, shown in a sidebar next to its image and description.
 * Without sign-up props only the dates are shown, as in the events list.
 */
const EventDetails = ({
  event,
  summaries: signupSummaries,
  onSignUp = noop,
  isSignedUp = () => false,
}: Props) => {
  const now = useNow()
  const showSignups = !!signupSummaries
  const summaries = signupSummaries ?? {}
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
      onSignUp={onSignUp}
      standalone={standalone}
    />
  )

  const renderSession = (session: EventSession) => {
    const target = sessionTarget(session)
    return (
      <SessionCard session={session} key={session.start}>
        {target && signupPanel(target)}
      </SessionCard>
    )
  }

  const eventSignupCard = eventTarget && (
    <Card>
      <Label>Sign-up</Label>
      <div className="text-xl">
        {sessions.length > 1 ? 'One sign-up for all dates' : 'Sign up for the event'}
      </div>
      {signupPanel(eventTarget, true)}
    </Card>
  )

  if (!sessions.length) {
    return (
      <div className="flex flex-col gap-4 text-lg text-left">
        <Card>
          <div className="text-xl">Time and place to be announced</div>
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
  const moreUpcoming = upcoming.slice(VISIBLE_DATES)
  // A few past dates are shown as they are when there's nothing upcoming
  const showPastDirectly = !upcoming.length && past.length <= VISIBLE_DATES

  return (
    <div className="flex flex-col gap-2 text-lg text-left">
      {!upcoming.length && !showPastDirectly && showSignups && (
        <Card>
          <div className="text-xl">No upcoming dates</div>
        </Card>
      )}
      {upcoming.slice(0, VISIBLE_DATES).map(renderSession)}
      {moreUpcoming.length > 0 && (
        <Collapsed
          label={`${moreUpcoming.length} more upcoming ${moreUpcoming.length === 1 ? 'date' : 'dates'}`}
        >
          {moreUpcoming.map(renderSession)}
        </Collapsed>
      )}
      {eventSignupCard && <div className="mt-2">{eventSignupCard}</div>}
      {showPastDirectly
        ? past.map(renderSession)
        : past.length > 0 && (
            <Collapsed label={`Past dates (${past.length})`}>{past.map(renderSession)}</Collapsed>
          )}
    </div>
  )
}

export default EventDetails
