import moment from 'moment'
import Head from 'next/head'
import EventList from '../components/EventList'
import Layout from '../components/Layout'
import { AGEvent } from '../types/types'
import { getFolder } from '../utils/fileUtils'

type Props = {
  events: AGEvent[]
}

const Events = ({ events }: Props) => {
  const recurringEvents: AGEvent[] = []
  const upcomingEvents: AGEvent[] = []
  const todayEvents: AGEvent[] = []
  const pastEvents: AGEvent[] = []
  events.forEach((event) => {
    const nowMoment = moment()
    const { isRecurring } = event
    const eventMoment = isRecurring ? nowMoment : moment(event.time, 'DD-MM-YYYY')
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
  return (
    <>
      <Head>
        <title>Events - Aalto Gamers</title>
      </Head>
      <Layout>
        <div>
          <EventList name="Events right now" events={todayEvents} />
          <EventList name="Upcoming events" events={upcomingEvents} />
          <EventList name="Recurring events" events={recurringEvents} />
          <EventList name="Past events" events={pastEvents} />
        </div>
      </Layout>
    </>
  )
}

export default Events

export const getStaticProps = () => ({
  props: { events: getFolder('events') },
})
