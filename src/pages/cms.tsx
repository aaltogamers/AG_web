import { useEffect } from 'react'
import EventPreview from '../previews/EventPreview'
import LandingInfosPreview from '../previews/LandingInfoPreview'
import PartnerPreview from '../previews/PartnerPreview'
import BoardMemberPreview from '../previews/BoardMemberPreview'
import AboutPreview from '../previews/AboutPreview'
import PartnersPreview from '../previews/PartnersPreview'
import AlbumPreview from '../previews/AlbumPreview'

const CMSPage = () => {
  useEffect(() => {
    ;(async () => {
      const CMS = (await import('decap-cms-app')).default
      CMS.init()
      CMS.registerPreviewStyle('/previewStyles.css')
      CMS.registerPreviewTemplate('landinginfo', LandingInfosPreview)
      CMS.registerPreviewTemplate('event', EventPreview)
      CMS.registerPreviewTemplate('partner', PartnerPreview)
      CMS.registerPreviewTemplate('boardmember', BoardMemberPreview)
      CMS.registerPreviewTemplate('about', AboutPreview)
      CMS.registerPreviewTemplate('partners', PartnersPreview)
      CMS.registerPreviewTemplate('album', AlbumPreview)
    })()
  }, [])

  return <div />
}
export default CMSPage
