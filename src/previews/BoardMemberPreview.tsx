import { PreviewTemplateComponentProps } from 'decap-cms-core'
import { AGBoardMember } from '../types/types'
import objFromPreviewProps from './objFromPreviewProps'
import BoardMember from '../components/BoardMember'

const BoardMemberPreview: React.FC<PreviewTemplateComponentProps> = (props) => {
  const boardMember = objFromPreviewProps(props, [
    'name',
    'image',
    'status',
    'title',
    'game',
  ]) as AGBoardMember
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 text-lg">
      <BoardMember boardMember={boardMember} isPreview />
    </div>
  )
}

export default BoardMemberPreview
