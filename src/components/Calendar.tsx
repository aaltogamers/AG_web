'use client'

import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import { AGEvent } from '../types/types'
import { CalendarEvent, convertEventsToCalendarFormat } from '../utils/eventUtils'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import styles from './Calendar.module.css'
import { useRouter } from 'next/router'
import { useState } from 'react'
import Markdown from './Markdown'

moment.locale('en-GB', {
  week: {
    dow: 1,
    doy: 1,
  },
})
const localizer = momentLocalizer(moment)

// Custom Event Component with enhanced tooltip
const CustomEvent = ({ event }: { event: CalendarEvent }) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span>{event.title}</span>
      </div>

      {showTooltip && (
        <div
          className="fixed bg-gray-900 text-white p-4 pb-0 rounded-lg shadow-2xl border border-gray-700 min-w-[250px] max-w-[350px]"
          style={{
            zIndex: 9999,
            left: '50%',
            bottom: '30px',
            transform: 'translate(-50%, 0)',
            pointerEvents: 'none',
          }}
        >
          <div className="font-bold text-lg mb-2">{event.title}</div>
          <div className="text-sm mb-1">
            {moment(event.start).format('D MMM YYYY HH:mm')} - {moment(event.end).format('HH:mm')}
          </div>
          {event.description && (
            <div className="border-t border-gray-700 pt-2 mt-2 text-wrap">
              <Markdown className="text-base">{event.description}</Markdown>
            </div>
          )}
        </div>
      )}
    </>
  )
}

type Props = {
  events: AGEvent[]
}

const Calendar = ({ events }: Props) => {
  const router = useRouter()
  const [copySuccess, setCopySuccess] = useState(false)
  const calendarEvents = convertEventsToCalendarFormat(events)

  const handleSelectEvent = (event: { url: string }) => {
    router.push(event.url)
  }

  const copyCalendarUrl = async () => {
    const calendarUrl = `${window.location.origin}/api/calendar`

    await navigator.clipboard.writeText(calendarUrl)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 10_000)
  }

  return (
    <div className="w-full mt-16 relative">
      <div className="flex justify-center mb-4 md:mb-0">
        <button
          onClick={copyCalendarUrl}
          className="mainbutton md:absolute top-[-16px] right-0 flex items-center "
        >
          {copySuccess ? 'Copied calendar URL to clipboard!' : 'Subscribe to the calendar'}
        </button>
      </div>

      <div className={`w-full ${styles.calendarWrapper}`} style={{ height: 600 }}>
        <BigCalendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          onSelectEvent={handleSelectEvent}
          views={['month']}
          defaultView="month"
          components={{
            event: CustomEvent,
          }}
        />
      </div>
    </div>
  )
}

export default Calendar
