import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import SideInfoBox from '../components/SideInfoBox'
import objFromPreviewProps from './objFromPreviewProps'

const LandingInfosPreview: React.FC<PreviewTemplateComponentProps> = (props) => {
  const obj = objFromPreviewProps(props, ['title', 'subtitle', 'content', 'image', 'link'])
  return (
    <SideInfoBox
      title={obj.title}
      subtitle={obj.subtitle}
      content={obj.content}
      image={obj.image}
      link={obj.link}
    />
  )
}

export default LandingInfosPreview
