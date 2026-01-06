import moment from 'moment-timezone'
import { AGEvent } from '../types/types'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  duration: number
  description: string
  location?: string
  url: string
}

/**
 * Converts AGEvent objects to a calendar-compatible format
 * Used by both the ICS export and the calendar UI component
 */
export const convertEventsToCalendarFormat = (events: AGEvent[]): CalendarEvent[] => {
  return events
    .flatMap((event) => {
      if (!event.otherTimes?.length) {
        return [{ ...event, id: event.slug }]
      }

      const otherEvents = event.otherTimes.map(({ time, name }) => {
        return {
          ...event,
          id: `${event.slug}-${moment(time).format('YYYYMMDDHHmm')}`,
          name: name || event.name,
          time,
        }
      })

      return [{ ...event, id: event.slug }, ...otherEvents]
    })
    .filter((event) => event.time && event.visibleOnCalendar)
    .map((event) => {
      const startDate = moment.tz(event.time!, 'Europe/Helsinki').toDate()

      const url = `https://aaltogamers.fi/events/${event.slug}`

      return {
        id: event.id,
        title: event.name,
        start: startDate,
        end: moment(startDate).add(event.durationHours, 'hours').toDate(),
        duration: event.durationHours,
        description: event.description + `\n\n${url}`,
        location: event.location,
        url,
      }
    })
}
