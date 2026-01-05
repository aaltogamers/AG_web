'use client'

import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import { AGEvent } from '../types/types'
import { convertEventsToCalendarFormat } from '../utils/eventUtils'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import styles from './Calendar.module.css'
import { useRouter } from 'next/router'

moment.locale('en-GB', {
  week: {
    dow: 1,
    doy: 1,
  },
})
const localizer = momentLocalizer(moment)

type Props = {
  events: AGEvent[]
}

const Calendar = ({ events }: Props) => {
  const router = useRouter()
  const calendarEvents = convertEventsToCalendarFormat(events)

  const handleSelectEvent = (event: { url: string }) => {
    router.push(event.url)
  }

  return (
    <div className={`w-full ${styles.calendarWrapper} mt-8`} style={{ height: 600 }}>
      <BigCalendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        onSelectEvent={handleSelectEvent}
        views={['month']}
        defaultView="month"
        tooltipAccessor={(event) => event.description}
        popup
      />
    </div>
  )
}

export default Calendar
