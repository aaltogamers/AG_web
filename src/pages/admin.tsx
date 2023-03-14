import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import { useEffect } from 'react'
import SideInfoBox from '../components/SideInfoBox'
import { AGEvent } from '../types/types'
import Event from './events/[pid]'

const landingInfosPreview: React.FC<PreviewTemplateComponentProps> = ({ entry, getAsset }) => {
  const image = entry.getIn(['data', 'image'])
  const imgSrc = getAsset(image)
  return (
    <SideInfoBox
      title={entry.getIn(['data', 'title'])}
      subtitle={entry.getIn(['data', 'subtitle'])}
      content={entry.getIn(['data', 'content'])}
      image={imgSrc.url}
      link={entry.getIn(['data', 'link'])}
    />
  )
}

const eventsPreview: React.FC<PreviewTemplateComponentProps> = ({ entry, getAsset }) => {
  const image = entry.getIn(['data', 'image'])
  const imgSrc = getAsset(image)
  const event: AGEvent = {
    name: entry.getIn(['data', 'name']),
    image: imgSrc.url,
    time: entry.getIn(['data', 'time']),
    content: entry.getIn(['data', 'content']),
    description: entry.getIn(['data', 'description']),
    isRecurring: entry.getIn(['data', 'isRecurring']),
    tldr: entry.getIn(['data', 'tldr']),
    slug: entry.getIn(['data', 'slug']),
  }
  return <Event event={event} />
}

const Admin = () => {
  useEffect(() => {
    ;(async () => {
      const CMS = (await import('netlify-cms-app')).default
      CMS.registerPreviewTemplate('landingInfos', landingInfosPreview)
      CMS.registerPreviewTemplate('events', eventsPreview)
      CMS.init()
    })()
  }, [])

  return <div />
}
export default Admin
