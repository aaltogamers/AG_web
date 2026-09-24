import { GetStaticPropsContext } from 'next'
import EventPage from '../../components/EventPage'
import { AGEvent } from '../../types/types'
import { getEvent, getFolder } from '../../utils/fileUtils'
import { getRelevantAlbumsForEvents } from '../../utils/getAlbumRelevantToEvent'
import { getLycheeAlbums } from '../../utils/lychee'

type Props = {
  event: AGEvent
}

const Event = ({ event }: Props) => <EventPage event={event} />

export default Event

export async function getStaticPaths() {
  const events = getFolder('events')

  return {
    paths: events.map((event) => ({ params: { pid: event.slug } })),
    fallback: false,
  }
}

export const getStaticProps = async (context: GetStaticPropsContext) => {
  const event = getEvent(String(context?.params?.pid))
  const albums = await getLycheeAlbums()

  getRelevantAlbumsForEvents([event], albums)

  if (!event.albumID) {
    delete event.albumID
  }

  return {
    props: { event: event },
  }
}
