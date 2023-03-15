import { useEffect } from 'react'
import EventPreview from '../previews/EventPreview'
import LandingInfosPreview from '../previews/LandingInfoPreview'
import PartnerPreview from '../previews/PartnerPreview'
import BoardMemberPreview from '../previews/BoardMemberPreview'
import AboutPreview from '../previews/AboutPreview'
import PartnersPreview from '../previews/PartnersPreview'
import AlbumPreview from '../previews/AlbumPreview'

const Admin = () => {
  useEffect(() => {
    ;(async () => {
      const CMS = (await import('netlify-cms-app')).default
      CMS.init()
      CMS.registerPreviewStyle('https://aaltogamers.fi/_next/static/css/78e8bd7be338bb55.css')
      CMS.registerPreviewTemplate('landing info', LandingInfosPreview)
      CMS.registerPreviewTemplate('event', EventPreview)
      CMS.registerPreviewTemplate('partner', PartnerPreview)
      CMS.registerPreviewTemplate('board member', BoardMemberPreview)
      CMS.registerPreviewTemplate('about', AboutPreview)
      CMS.registerPreviewTemplate('partners', PartnersPreview)
      CMS.registerPreviewTemplate('album', AlbumPreview)
    })()
  }, [])

  return <div />
}
export default Admin
