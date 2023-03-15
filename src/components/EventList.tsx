import moment from 'moment'
import { AGEvent } from '../types/types'
import Event from './Event'
import Header from './Header'

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
          <Event event={event} key={event.name} />
        ))}
    </div>
  ) : null
}

export default EventList
