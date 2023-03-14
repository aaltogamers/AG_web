import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import { AGEvent } from '../types/types'
import Event from '../pages/events/[pid]'

const EventsPreview: React.FC<PreviewTemplateComponentProps> = ({ entry }) => {
  const event: AGEvent = {
    name: entry.getIn(['data', 'name']),
    image: entry.getIn(['data', 'image']),
    time: entry.getIn(['data', 'time']),
    content: entry.getIn(['data', 'body']),
    description: entry.getIn(['data', 'description']),
    isRecurring: entry.getIn(['data', 'isRecurring']),
    tldr: entry.getIn(['data', 'tldr']),
    slug: '',
  }
  return <Event event={event} isPreview />
}

export default EventsPreview
