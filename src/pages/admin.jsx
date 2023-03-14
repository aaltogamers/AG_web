import { useEffect } from 'react'
import SideInfoBox from '../components/SideInfoBox'

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

const Admin = () => {
  useEffect(() => {
    ;(async () => {
      const CMS = (await import('netlify-cms-app')).default
      CMS.registerPreviewTemplate('landingInfos', SideInfoBox)
      CMS.registerPreviewTemplate('events', Event)
      CMS.init()
    })()
  }, [])

  return <div />
}
export default Admin
