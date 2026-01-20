import { AGBoardMember } from '../types/types'
import AGImage from './AGImage'

type Props = {
  boardMember: AGBoardMember
  showContactInfo?: boolean
}
const BoardMember = ({ boardMember, showContactInfo }: Props) => {
  return (
    <div className="flex flex-col align-center text-center">
      <AGImage
        src={boardMember.image || '/images/board-placeholder.png'}
        alt={boardMember.name}
        className="aspect-3/4 object-cover"
      />
      <h3 className="mt-4 break-words">{boardMember.title || 'Board Member'}</h3>
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
