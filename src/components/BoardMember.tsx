import { AGBoardMember } from '../types/types'
import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'

type Props = {
  boardMember: AGBoardMember
  isPreview?: boolean
  showContactInfo?: boolean
}
const BoardMember = ({ boardMember, isPreview, showContactInfo }: Props) => {
  return (
    <div className="flex flex-col align-center m-8 text-center">
      <ImageThatWorksWithPreview
        src={boardMember.image || '/images/board-placeholder.png'}
        alt={boardMember.name}
        isPreview={isPreview || false}
      />
      {boardMember.title && <h3 className="mt-4">{boardMember.title}</h3>}
      <h4>{boardMember.name}</h4>
      <div className="mt-4">
        {boardMember.status && (
          <span>
            {boardMember.status}
            <br />
          </span>
        )}

        {boardMember.game && (
          <span>
            Favorite game: {boardMember.game}
            <br />
          </span>
        )}
        {boardMember.contactInformation && showContactInfo && (
          <span>{boardMember.contactInformation}</span>
        )}
      </div>
    </div>
  )
}

export default BoardMember
