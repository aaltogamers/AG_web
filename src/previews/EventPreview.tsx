import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import { AGEvent } from '../types/types'
import EventPage from '../pages/events/[pid]'
import objFromPreviewProps from './objFromPreviewProps'
import Event from '../components/Event'

const EventsPreview: React.FC<PreviewTemplateComponentProps> = (props) => {
  const event = objFromPreviewProps(props, [
    'name',
    'image',
    'time',
    'content',
    'description',
    'isRecurring',
    'tldr',
  ]) as AGEvent
  return (
    <div>
      <div className="flex justify-center">
        <Event event={event} isPreview />
      </div>
      <EventPage event={event} isPreview />
    </div>
  )
}

export default EventsPreview
