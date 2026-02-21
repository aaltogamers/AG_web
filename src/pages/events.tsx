import Head from 'next/head'
import EventList from '../components/EventList'
import PageWrapper from '../components/PageWrapper'
import { AGEvent } from '../types/types'
import { getFolder } from '../utils/fileUtils'
import { parseEvents } from '../utils/parseEvents'
import Calendar from '../components/Calendar'
import Header from '../components/Header'
import { getLycheeAlbums } from '../utils/lychee'
import { getRelevantAlbumsForEvents } from '../utils/getAlbumRelevantToEvent'

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
        <Header>Event Calendar</Header>
        <Calendar events={events} />
        <EventList name="Events right now" events={todayEvents} />
        <EventList name="Upcoming events" events={upcomingEvents} />
        <EventList name="Recurring events" events={recurringEvents} />
        <EventList name="Past events" events={pastEvents} />
      </div>
    </PageWrapper>
  )
}

export default Events

export const getStaticProps = async () => {
  const events = getFolder('events') as AGEvent[]
  const albums = await getLycheeAlbums()

  getRelevantAlbumsForEvents(events, albums)

  return {
    props: { events: events },
  }
}
