import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import SideInfoBox from '../components/SideInfoBox'

const LandingInfosPreview: React.FC<PreviewTemplateComponentProps> = ({ entry, getAsset }) => {
  const image = entry.getIn(['data', 'image'])
  const imgSrc = getAsset(image)
  return (
    <SideInfoBox
      title={entry.getIn(['data', 'title'])}
      subtitle={entry.getIn(['data', 'subtitle'])}
      content={entry.getIn(['data', 'content'])}
      image={imgSrc.url}
      link={entry.getIn(['data', 'link'])}
    />
  )
}

export default LandingInfosPreview
