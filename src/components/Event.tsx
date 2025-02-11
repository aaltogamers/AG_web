import { AGEvent } from '../types/types'
import AGImage from './AGImage'
import Markdown from './Markdown'

interface Props {
  event: AGEvent
}

const Event = ({ event }: Props) => {
  return (
    <div className="flex flex-col md:w-3/4 " key={event.name}>
      <hr className="bg-gray w-full my-16" />
      <div className="md:grid md:grid-cols-event md:flex-row text-center md:text-left items-center">
        <AGImage src={event.image} alt={event.name} className="max-h-96 object-contain" />
        <div className="flex flex-col md:p-10 items-center md:items-start">
          <h3 className="mt-8 md:mt-0">{event.name}</h3>
          <Markdown>{event.description}</Markdown>
          <a href={`/events/${event.slug}`} className="mainbutton">
            Learn more
          </a>
        </div>
      </div>
    </div>
  )
}

export default Event
