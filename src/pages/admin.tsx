import { useEffect } from 'react'
import EventPreview from '../previews/EventPreview'
import LandingInfosPreview from '../previews/LandingInfoPreview'

const Admin = () => {
  useEffect(() => {
    ;(async () => {
      const CMS = (await import('netlify-cms-app')).default
      CMS.init()
      CMS.registerPreviewTemplate('events', EventPreview)
      // CMS.registerPreviewTemplate('landingInfos', LandingInfosPreview)
    })()
  }, [])

  return <div />
}
export default Admin
