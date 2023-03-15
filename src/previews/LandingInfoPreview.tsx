import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import SideInfoBox from '../components/SideInfoBox'
import { LandingInfo } from '../types/types'
import objFromPreviewProps from './objFromPreviewProps'

const LandingInfosPreview: React.FC<PreviewTemplateComponentProps> = (props) => {
  const landingInfo = objFromPreviewProps(props, [
    'title',
    'subtitle',
    'content',
    'image',
    'link',
  ]) as LandingInfo
  return <SideInfoBox landingInfo={landingInfo} />
}

export default LandingInfosPreview
