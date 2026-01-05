import Link from 'next/link'
import { AGEvent } from '../types/types'
import { parseEvents } from '../utils/parseEvents'
import AGImage from './AGImage'
import SmallHeader from './SmallHeader'

type Props = {
  events: AGEvent[]
}

const EventShowCase = ({ events }: Props) => {
  const { upcomingEvents, todayEvents, pastEvents, recurringEvents } = parseEvents(events)
  const sortedEvents = [...recurringEvents, ...todayEvents, ...upcomingEvents, ...pastEvents]
  const exessEvents = sortedEvents.length % 4
  const shownEvents = sortedEvents
    .filter((item): item is AGEvent & { image: string } => !!item.image)
    .slice(0, sortedEvents.length - exessEvents)

  return (
    <section className="flex flex-col items-center gap-8 ">
      <SmallHeader>Events</SmallHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-4/5">
        {shownEvents.map((event) => (
          <Link href={`/events/${event.slug}`} className="hover:brightness-75" key={event.slug}>
            <AGImage src={event.image} alt={event.name} />
          </Link>
        ))}
      </div>
    </section>
  )
}

export default EventShowCase
