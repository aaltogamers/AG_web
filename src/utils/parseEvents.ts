import { AGEvent } from '../types/types'
import moment from 'moment'

export const parseEvents = (events: AGEvent[]) => {
  const recurringEvents: AGEvent[] = []
  const upcomingEvents: AGEvent[] = []
  const todayEvents: AGEvent[] = []
  const pastEvents: AGEvent[] = []
  const nowMoment = moment()
  events
    .sort((event1, event2) => {
      const event1Moment = moment(event1.time)
      const event2Moment = moment(event2.time)
      return Math.abs(nowMoment.diff(event1Moment)) > Math.abs(nowMoment.diff(event2Moment))
        ? 1
        : -1
    })
    .forEach((event) => {
      const { isRecurring, visibleOnEventsPage } = event
      if (!visibleOnEventsPage) {
        return
      }

      const eventMoment = isRecurring ? nowMoment : moment(event.time)
      const isToday = eventMoment.isSame(nowMoment, 'day')
      const isInFuture = eventMoment.isAfter(nowMoment)
      if (isRecurring) {
        recurringEvents.push(event)
      } else if (isToday) {
        todayEvents.push(event)
      } else if (isInFuture) {
        upcomingEvents.push(event)
      } else {
        pastEvents.push(event)
      }
    })
  return { recurringEvents, upcomingEvents, todayEvents, pastEvents }
}
