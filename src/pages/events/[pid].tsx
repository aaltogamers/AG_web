import { GetServerSidePropsContext } from 'next'
import EventPage from '../../components/EventPage'
import { AGEvent } from '../../types/types'
import { getEvents } from '../../utils/eventStore'
import { getRelevantAlbumsForEvents } from '../../utils/getAlbumRelevantToEvent'
import { getLycheeAlbums } from '../../utils/lychee'

type Props = {
  event: AGEvent
}

const Event = ({ event }: Props) => <EventPage event={event} />

export default Event

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const [events, albums] = await Promise.all([getEvents(), getLycheeAlbums()])
  const event = events.find((e) => e.slug === String(context.params?.pid))
  if (!event) return { notFound: true }

  getRelevantAlbumsForEvents([event], albums)

  if (!event.albumID) {
    delete event.albumID
  }

  return {
    props: { event: event },
  }
}
