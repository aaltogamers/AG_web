import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import SideInfoBox from '../components/SideInfoBox'

const LandingInfosPreview: React.FC<PreviewTemplateComponentProps> = ({ entry }) => {
  return (
    <SideInfoBox
      title={entry.getIn(['data', 'title'])}
      subtitle={entry.getIn(['data', 'subtitle'])}
      content={entry.getIn(['data', 'content'])}
      image={entry.getIn(['data', 'image'])}
      link={entry.getIn(['data', 'link'])}
    />
  )
}

export default LandingInfosPreview
