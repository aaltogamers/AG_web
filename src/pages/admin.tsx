import { useEffect } from 'react'
import EventPreview from '../previews/EventPreview'
import LandingInfosPreview from '../previews/LandingInfoPreview'

const Admin = () => {
  useEffect(() => {
    ;(async () => {
      const CMS = (await import('netlify-cms-app')).default
      CMS.init()
      CMS.registerPreviewStyle('https://aaltogamers.fi/_next/static/css/78e8bd7be338bb55.css')
      CMS.registerPreviewTemplate('landingInfos', LandingInfosPreview)
      CMS.registerPreviewTemplate('events', EventPreview)
    })()
  }, [])

  return <div />
}
export default Admin
