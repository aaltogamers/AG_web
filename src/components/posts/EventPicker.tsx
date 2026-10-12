import { useEffect, useMemo, useRef } from 'react'
import moment from 'moment'
import { FaBan } from 'react-icons/fa'
import type { AGEvent } from '../../types/types'
import { eventMoment, getRelevantSession } from '../../utils/eventUtils'
import EventThumbnail from '../EventThumbnail'

type Props = {
  events: AGEvent[]
  value: string
  onChange: (eventSlug: string) => void
  noEventLabel: string
  disabled?: boolean
}

// Events that ended at most this long ago are still shown
const PAST_DAYS_SHOWN = 2

// A row of event cards like the sign-up page's, with only upcoming and recent events
const EventPicker = ({ events, value, onChange, noEventLabel, disabled }: Props) => {
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())

  // Each event with its first session that ended at most PAST_DAYS_SHOWN days ago
  const shownEvents = useMemo(() => {
    const cutoff = moment().subtract(PAST_DAYS_SHOWN, 'days')
    return events
      .map((event) => ({ event, session: getRelevantSession(event, cutoff) }))
      .filter(
        // The chosen event stays even if it is older
        ({ event, session }) =>
          event.slug === value || (session && eventMoment(session.end).isAfter(cutoff))
      )
      .sort(
        (a, b) =>
          (a.session ? eventMoment(a.session.start).valueOf() : 0) -
          (b.session ? eventMoment(b.session.start).valueOf() : 0)
      )
  }, [events, value])

  // Keeps the chosen event visible in the row of events
  useEffect(() => {
    cardRefs.current.get(value)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [value])

  const cardClass = (isSelected: boolean) =>
    `w-28 shrink-0 flex flex-col gap-1 text-left rounded-md p-1 border-2 disabled:opacity-60 ${
      isSelected ? 'border-red' : 'border-transparent enabled:hover:border-lightgray'
    }`

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      <button
        ref={(el) => {
          if (el) cardRefs.current.set('', el)
          else cardRefs.current.delete('')
        }}
        type="button"
        onClick={() => onChange('')}
        disabled={disabled}
        className={cardClass(value === '')}
      >
        <div className="w-full aspect-square rounded-md border border-lightgray flex items-center justify-center text-lightgray">
          <FaBan size={32} />
        </div>
        <span className="text-sm leading-tight line-clamp-3">{noEventLabel}</span>
      </button>
      {shownEvents.map(({ event, session }) => {
        return (
          <button
            key={event.slug}
            ref={(el) => {
              if (el) cardRefs.current.set(event.slug, el)
              else cardRefs.current.delete(event.slug)
            }}
            type="button"
            onClick={() => onChange(event.slug)}
            disabled={disabled}
            className={cardClass(event.slug === value)}
          >
            <EventThumbnail image={event.image} />
            <span className="text-sm leading-tight line-clamp-2">{event.name}</span>
            <span className="text-xs text-lightgray">{session ? eventMoment(session.start).format('D.M.YYYY') : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

export default EventPicker
