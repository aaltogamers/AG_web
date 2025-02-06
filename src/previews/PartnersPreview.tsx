import { PreviewTemplateComponentProps } from 'decap-cms-core'
import objFromPreviewProps from './objFromPreviewProps'
import Partners from '../pages/partners'

const PartnersPreview: React.FC<PreviewTemplateComponentProps> = (props) => {
  const about = objFromPreviewProps(props, ['title', 'content'])
  return <Partners title={about.title} content={about.content} partners={[]} />
}

export default PartnersPreview
