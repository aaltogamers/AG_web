import moment from 'moment'
import { AGEvent } from '../types/types'
import Header from './Header'
import Markdown from './Markdown'

type Props = {
  name: string
  events: AGEvent[]
}

const EventList = ({ events, name }: Props) => {
  return events.length > 0 ? (
    <div className="flex flex-col w-full items-center">
      <Header>{name}</Header>
      {events
        .sort((event1, event2) => {
          const event1Moment = moment(event1.time, 'DD-MM-YYYY')
          const event2Moment = moment(event2.time, 'DD-MM-YYYY')
          return event1Moment.isBefore(event2Moment) ? 1 : -1
        })
        .map((event) => (
          <div className="flex flex-col py-20 w-3/4 justify-center" key={event.name}>
            <hr className="bg-gray w-full" />
            <div className="flex">
              <img
                src={event.image}
                alt={`${event.name}`}
                className="w-[40%] max-h-96 object-contain"
              />
              <div className="flex flex-col p-10">
                <h3>{event.name}</h3>
                <Markdown>{event.description}</Markdown>
                <a href="/events-2022-lol-osm" className="mainbutton">
                  Learn more
                </a>
              </div>
            </div>
          </div>
        ))}
    </div>
  ) : null
}

export default EventList
