import { AGEvent } from '../types/types'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
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
      const endDate = new Date(startDate)
      endDate.setHours(endDate.getHours() + event.durationHours)

      return {
        id: event.slug,
        title: event.name,
        start: startDate,
        end: endDate,
        description: event.description,
        url: `https://aaltogamers.fi/events/${event.slug}`,
      }
    })
}
