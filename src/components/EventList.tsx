import moment from 'moment'
import ExportedImage from 'next-image-export-optimizer'
import { AGEvent } from '../types/types'
import Header from './Header'
import Markdown from './Markdown'

type Props = {
  name: string
  events: AGEvent[]
}

const EventList = ({ events, name }: Props) => {
  const nowMoment = moment()
  return events.length > 0 ? (
    <div className="flex flex-col w-full items-center">
      <Header>{name}</Header>
      {events
        .sort((event1, event2) => {
          const event1Moment = moment(event1.time, 'DD-MM-YYYY')
          const event2Moment = moment(event2.time, 'DD-MM-YYYY')
          return Math.abs(nowMoment.diff(event1Moment)) > Math.abs(nowMoment.diff(event2Moment))
            ? 1
            : -1
        })
        .map((event) => (
          <div className="flex flex-col w-3/4 justify-center" key={event.name}>
            <hr className="bg-gray w-full" />
            <div className="flex flex-col md:flex-row text-center md:text-left items-center">
              <ExportedImage
                src={event.image}
                alt=""
                width={1500}
                height={1500}
                className="w-full md:w-2/5 max-h-96 object-contain"
              />

              <div className="flex flex-col md:p-10 items-center md:items-start">
                <h3 className="mt-8 md:mt-0">{event.name}</h3>
                <Markdown>{event.description}</Markdown>
                <a href={`/events/${event.slug}`} className="mainbutton">
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
