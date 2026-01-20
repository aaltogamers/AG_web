import { AGEvent } from '../types/types'
import Event from './Event'
import Header from './Header'

type Props = {
  name: string
  events: AGEvent[]
}

const EventList = ({ events, name }: Props) => {
  return events.length > 0 ? (
    <div className="flex flex-col w-full items-center">
      <Header>{name}</Header>
      {events
        .filter((event) => event.visibleOnEventsPage)
        .map((event) => (
          <Event event={event} key={event.name} />
        ))}
    </div>
  ) : null
}

export default EventList
