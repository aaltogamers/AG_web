import ReactMarkdown from 'react-markdown'
import { AGEvent } from '../types/types'

type Props = {
  name: string
  events: AGEvent[]
}

const EventList = ({ events, name }: Props) => {
  return events.length > 0 ? (
    <div>
      <h2>{name}</h2>
      {events.map((event) => (
        <div key={event.name}>
          <h3>{event.name}</h3>
          <img src={event.image} alt={`${event.name}`} />
          <ReactMarkdown>{event.description}</ReactMarkdown>
        </div>
      ))}
    </div>
  ) : null
}

export default EventList
