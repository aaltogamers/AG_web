import moment from 'moment'
import { AGEvent } from '../types/types'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  duration: number
  description: string
  url: string
}

/**
 * Converts AGEvent objects to a calendar-compatible format
 * Used by both the ICS export and the calendar UI component
 */
export const convertEventsToCalendarFormat = (events: AGEvent[]): CalendarEvent[] => {
  return events
    .filter((event) => event.time && event.visibleOnCalendar)
    .map((event) => {
      const startDate = new Date(event.time!)

      return {
        id: event.slug,
        title: event.name,
        start: startDate,
        end: moment(startDate).add(event.durationHours, 'hours').toDate(),
        duration: event.durationHours,
        description: event.description,
        url: `https://aaltogamers.fi/events/${event.slug}`,
      }
    })
}
