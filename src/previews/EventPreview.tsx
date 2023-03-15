import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import { AGEvent } from '../types/types'
import Event from '../pages/events/[pid]'
import objFromPreviewProps from './objFromPreviewProps'

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
  return <Event event={event} isPreview />
}

export default EventsPreview
