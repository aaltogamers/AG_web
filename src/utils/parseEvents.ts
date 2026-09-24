import moment from 'moment'
import { AGEvent } from '../types/types'
import { eventMoment, getRelevantSession } from './eventUtils'

export const parseEvents = (events: AGEvent[]) => {
  const upcomingEvents: AGEvent[] = []
  const todayEvents: AGEvent[] = []
  const pastEvents: AGEvent[] = []
  const nowMoment = moment()
  const distanceFromNow = (event: AGEvent) => {
    const session = getRelevantSession(event, nowMoment)
    return session ? Math.abs(nowMoment.diff(eventMoment(session.start))) : 0
  }
  events
    .sort((event1, event2) => distanceFromNow(event1) - distanceFromNow(event2))
    .forEach((event) => {
      const { visibleOnEventsPage, sessions } = event
      if (!visibleOnEventsPage) {
        return
      }

      const isToday = sessions.some(
        ({ start, end }) =>
          eventMoment(start).isSame(nowMoment, 'day') ||
          nowMoment.isBetween(eventMoment(start), eventMoment(end))
      )
      // Events without sessions have no date yet
      const isInFuture =
        !sessions.length || sessions.some(({ start }) => eventMoment(start).isAfter(nowMoment))
      if (isToday) {
        todayEvents.push(event)
      } else if (isInFuture) {
        upcomingEvents.push(event)
      } else {
        pastEvents.push(event)
      }
    })
  return { upcomingEvents, todayEvents, pastEvents }
}
