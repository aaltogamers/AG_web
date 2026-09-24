import moment, { Moment } from 'moment'
import { ReactNode } from 'react'
import { FaMapMarkerAlt, FaRegCalendar, FaRegClock } from 'react-icons/fa'
import { AGEvent, EventSession } from '../types/types'
import {
  eventMoment,
  formatSessionTime,
  formatSignupTime,
  getSignupStatus,
  getSignupTargets,
  SignupTarget,
} from '../utils/eventUtils'
import { SignupEvent } from '../utils/signupApi'
import { useNow } from '../utils/useNow'

// With more sessions than this, past ones are collapsed into a list
const MAX_SESSION_CARDS = 3

type Props = {
  event: AGEvent
  // Sign-up forms by target key, for sessions that have one
  signupForms: Record<string, SignupEvent>
  selectedSignupKey: string | null
  onSelectSignup: (key: string) => void
}

// Same accent as the red bars under headers. A dimmed bar marks sign-ups that aren't selected.
const Card = ({ children, dimmed }: { children: ReactNode; dimmed?: boolean }) => (
  <div
    className={`flex flex-col bg-darkgray border-l-4 px-6 py-5 transition-colors ${
      dimmed ? 'border-gray-600' : 'border-red'
    }`}
  >
    {children}
  </div>
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

const SignupFooter = ({
  target,
  signupEvent,
  now,
  onSelect,
  standalone = false,
}: {
  target: SignupTarget
  signupEvent: SignupEvent
  now: Moment | null
  onSelect: (key: string) => void
  // On its own card, which already has a heading, rather than under a session
  standalone?: boolean
}) => {
  const status = now && getSignupStatus(signupEvent, now)
  const text =
    status === 'notOpen'
      ? `Opens ${formatSignupTime(moment(signupEvent.openfrom))}`
      : status === 'closed'
        ? 'Closed'
        : status === 'open'
          ? `Open until ${formatSignupTime(moment(signupEvent.openuntil))}`
          : ''
  const select = () => {
    onSelect(target.key)
    document.getElementById('signup-section')?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <div
      className={`flex flex-wrap gap-x-6 gap-y-3 items-center justify-between ${
        standalone ? 'mt-3' : 'border-t border-gray-600 mt-4 pt-4'
      }`}
    >
      <div>
        {!standalone && (
          <div className="uppercase tracking-widest text-sm text-lightgray">Sign-up</div>
        )}
        <div>{text}</div>
      </div>
      <button
        type="button"
        className={`${status === 'open' ? 'mainbutton' : 'borderbutton'} !text-lg !py-2 !px-6`}
        onClick={select}
      >
        {status === 'open' ? 'Sign up' : 'View sign-ups'}
      </button>
    </div>
  )
}

const SessionCard = ({
  session,
  children,
  dimmed,
}: {
  session: EventSession
  children?: ReactNode
  dimmed?: boolean
}) => {
  const { date, time } = getDateAndTime(session)
  return (
    <Card dimmed={dimmed}>
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

/** Times, places and sign-ups of an event, shown next to its image */
const EventDetails = ({ event, signupForms, selectedSignupKey, onSelectSignup }: Props) => {
  const now = useNow()
  const targets = getSignupTargets(event)
  const { sessions } = event

  // Which sessions are past is only known in the browser
  const collapsePast = sessions.length > MAX_SESSION_CARDS
  const isPast = (session: EventSession) => !!now && eventMoment(session.end).isBefore(now)
  const cardSessions = collapsePast ? sessions.filter((s) => now && !isPast(s)) : sessions
  const pastSessions = collapsePast ? sessions.filter(isPast).reverse() : []

  const sessionTarget = (session: EventSession) =>
    targets.find((t) => t.session === session && signupForms[t.key])
  const eventTarget = targets.find((t) => !t.session && signupForms[t.key])

  return (
    <div className="flex flex-col gap-4 text-lg text-left">
      {!sessions.length && (
        <Card>
          <div className="text-2xl">Time and place to be announced</div>
        </Card>
      )}
      {collapsePast && now && !cardSessions.length && (
        <Card>
          <div className="text-2xl">No upcoming dates</div>
        </Card>
      )}
      {cardSessions.map((session) => {
        const target = sessionTarget(session)
        return (
          <SessionCard
            session={session}
            key={session.start}
            dimmed={!!target && target.key !== selectedSignupKey}
          >
            {target && (
              <SignupFooter
                target={target}
                signupEvent={signupForms[target.key]}
                now={now}
                onSelect={onSelectSignup}
              />
            )}
          </SessionCard>
        )
      })}
      {eventTarget && (
        <Card>
          <Label>Sign-up</Label>
          <div className="text-2xl">
            {sessions.length > 1 ? 'One sign-up for all dates' : 'Sign up for the event'}
          </div>
          <SignupFooter
            target={eventTarget}
            signupEvent={signupForms[eventTarget.key]}
            now={now}
            onSelect={onSelectSignup}
            standalone
          />
        </Card>
      )}
      {pastSessions.length > 0 && (
        <details className="text-base text-lightgray">
          <summary className="cursor-pointer uppercase tracking-widest text-sm hover:text-red">
            Past dates ({pastSessions.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-1 border-l-4 border-gray-600 pl-6">
            {pastSessions.map((session) => (
              <li key={session.start}>
                {formatSessionTime(session)}
                {session.name && ` · ${session.name}`}
                {session.location && ` · ${session.location}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export default EventDetails
