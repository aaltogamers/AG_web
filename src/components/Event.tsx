import { AGEvent } from '../types/types'
import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'
import Markdown from './Markdown'

interface Props {
  event: AGEvent
  isPreview?: boolean
}

const Event = ({ event, isPreview }: Props) => {
  return (
    <div className="flex flex-col w-3/4 justify-center" key={event.name}>
      <hr className="bg-gray w-full" />
      <div className="flex flex-col md:flex-row text-center md:text-left items-center">
        <ImageThatWorksWithPreview
          src={event.image}
          alt=""
          className="w-full md:w-2/5 max-h-96 object-contain"
          isPreview={isPreview || false}
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
  )
}

export default Event
