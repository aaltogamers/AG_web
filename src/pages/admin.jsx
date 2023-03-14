import dynamic from 'next/dynamic'
import SideInfoBox from '../components/SideInfoBox'
import Event from './events/[pid]'

const landingInfosPreview = ({ entry, getAsset }) => {
  const image = entry.getIn(['data', 'image'])
  const imgSrc = getAsset(image)
  return (
    <SideInfoBox
      title={entry.getIn(['data', 'title'])}
      subtitle={entry.getIn(['data', 'subtitle'])}
      content={entry.getIn(['data', 'content'])}
      image={imgSrc}
      link={entry.getIn(['data', 'link'])}
    />
  )
}

const CMS = dynamic(
  () =>
    import('netlify-cms-app').then(async (cms) => {
      cms.init()
      cms.registerPreviewTemplate('landingInfos', landingInfosPreview)
      cms.registerPreviewTemplate('events', Event)
    }),
  { ssr: false, loading: () => <p>Loading Admin...</p> }
)

const Admin = () => {
  return <CMS />
}
export default Admin
