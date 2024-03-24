import Head from 'next/head'
import EventList from '../components/EventList'
import PageWrapper from '../components/PageWrapper'
import { AGEvent } from '../types/types'
import { getFolder } from '../utils/fileUtils'
import { parseEvents } from '../utils/parseEvents'

type Props = {
  events: AGEvent[]
}

const Events = ({ events }: Props) => {
  const { recurringEvents, upcomingEvents, todayEvents, pastEvents } = parseEvents(events)
  return (
    <PageWrapper>
      <Head>
        <title>Events - Aalto Gamers</title>
      </Head>
      <div>
        <EventList name="Events right now" events={todayEvents} />
        <EventList name="Upcoming events" events={upcomingEvents} />
        <EventList name="Recurring events" events={recurringEvents} />
        <EventList name="Past events" events={pastEvents} />
      </div>
    </PageWrapper>
  )
}

export default Events

export const getStaticProps = () => ({
  props: { events: getFolder('events') },
})
