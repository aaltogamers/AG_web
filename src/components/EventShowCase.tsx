import Link from 'next/link'
import { AGEvent } from '../types/types'
import { parseEvents } from '../utils/parseEvents'
import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'

type Props = {
  events: AGEvent[]
}

const EventShowCase = ({ events }: Props) => {
  const { upcomingEvents, todayEvents, pastEvents, recurringEvents } = parseEvents(events)
  const sortedEvents = [...recurringEvents, ...todayEvents, ...upcomingEvents, ...pastEvents]
  const exessEvents = sortedEvents.length % 4
  const shownEvents = sortedEvents.slice(0, sortedEvents.length - exessEvents)
  return (
    <section className="flex flex-col items-center gap-8 ">
      <h2 className="border-red border-b-4 px-8 pb-4 mb-8">Aalto Gamers Events</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-4/5">
        {shownEvents.map((event) => (
          <Link href={`/events/${event.slug}`} className="hover:brightness-75">
            <ImageThatWorksWithPreview src={event.image} alt={event.name} isPreview={false} />
          </Link>
        ))}
      </div>
    </section>
  )
}

export default EventShowCase
