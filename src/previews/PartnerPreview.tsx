import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import { AGPartner } from '../types/types'
import objFromPreviewProps from './objFromPreviewProps'
import Partner from '../components/Partner'

const PartnerPreview: React.FC<PreviewTemplateComponentProps> = (props) => {
  const partner = objFromPreviewProps(props, [
    'name',
    'image',
    'description',
    'content',
    'finnishLink',
    'englishLink',
  ]) as AGPartner
  return <Partner partner={partner} isPreview />
}

export default PartnerPreview
