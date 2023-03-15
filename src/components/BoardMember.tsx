import { AGBoardMember } from '../types/types'
import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'

type Props = {
  boardMember: AGBoardMember
  isPreview?: boolean
}
const BoardMember = ({ boardMember, isPreview }: Props) => {
  return (
    <div className="flex flex-col align-center m-8">
      <ImageThatWorksWithPreview
        src={boardMember.image || '/images/board-placeholder.png'}
        alt={boardMember.name}
        isPreview={isPreview || false}
      />
      <h3 className="mt-4">{boardMember.title}</h3>
      <h4>{boardMember.name}</h4>
      <div className="mt-4 ">
        {boardMember.status}
        <br />
        Favorite game: {boardMember.game}
      </div>
    </div>
  )
}

export default BoardMember
