import Link from 'next/link'
import { AGEvent } from '../types/types'
import { DEFAULT_EVENT_IMAGE } from '../utils/eventUtils'
import { parseEvents } from '../utils/parseEvents'
import AGImage from './AGImage'
import SmallHeader from './SmallHeader'

type Props = {
  events: AGEvent[]
}

const EventShowCase = ({ events }: Props) => {
  const { upcomingEvents, todayEvents, pastEvents } = parseEvents(events)
  const sortedEvents = [...todayEvents, ...upcomingEvents, ...pastEvents]
  const exessEvents = sortedEvents.length % 4
  // Events without their own image would just repeat the logo
  const shownEvents = sortedEvents
    .filter((event) => event.image !== DEFAULT_EVENT_IMAGE)
    .slice(0, sortedEvents.length - exessEvents)

  return (
    <section className="flex flex-col items-center gap-8 ">
      <SmallHeader>Events</SmallHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-4/5">
        {shownEvents.map((event) => (
          <Link href={`/events/${event.slug}`} className="hover:brightness-75" key={event.slug}>
            <AGImage src={event.image} alt={event.name} className="aspect-square" />
          </Link>
        ))}
      </div>
    </section>
  )
}

export default EventShowCase
