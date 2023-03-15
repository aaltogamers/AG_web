import { PreviewTemplateComponentProps } from 'netlify-cms-core'
import objFromPreviewProps from './objFromPreviewProps'
import About from '../pages/about'

const BoardMemberPreview: React.FC<PreviewTemplateComponentProps> = (props) => {
  const about = objFromPreviewProps(props, ['title', 'content', 'boardTitle'])
  return (
    <About
      title={about.title}
      content={about.content}
      boardMembers={[]}
      boardTitle={about.boardTitle}
    />
  )
}

export default BoardMemberPreview
