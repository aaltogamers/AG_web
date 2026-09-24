import Head from 'next/head'
import EventList from '../components/EventList'
import PageWrapper from '../components/PageWrapper'
import { AGEvent } from '../types/types'
import { getEvents } from '../utils/fileUtils'
import { parseEvents } from '../utils/parseEvents'
import Calendar from '../components/Calendar'
import Header from '../components/Header'
import CmsEditLink from '../components/CmsEditLink'
import { getLycheeAlbums } from '../utils/lychee'
import { getRelevantAlbumsForEvents } from '../utils/getAlbumRelevantToEvent'

type Props = {
  events: AGEvent[]
}

const Events = ({ events }: Props) => {
  const { upcomingEvents, todayEvents, pastEvents } = parseEvents(events)
  return (
    <PageWrapper>
      <Head>
        <title>Events - Aalto Gamers</title>
      </Head>
      <div>
        <Header>Event Calendar</Header>
        <CmsEditLink cmsPath="collections/event" label="Edit events" className="mt-4" />
        <Calendar events={events} />
        <EventList name="Events right now" events={todayEvents} />
        <EventList name="Upcoming events" events={upcomingEvents} />
        <EventList name="Past events" events={pastEvents} />
      </div>
    </PageWrapper>
  )
}

export default Events

export const getStaticProps = async () => {
  const events = getEvents()
  const albums = await getLycheeAlbums()

  getRelevantAlbumsForEvents(events, albums)

  return {
    props: { events: events },
  }
}
