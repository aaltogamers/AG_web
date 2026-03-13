import { Id, Match, Participant } from 'brackets-model'
import { BracketStyles } from '../types/types'

type Props = {
  match: Match
  participant: 'opponent1' | 'opponent2'
  participantsById: Record<Id, Participant>
  bracketStyles: BracketStyles
}

const MatchResultRow = ({ match, participant, participantsById, bracketStyles }: Props) => {
  const participantData = match[participant]

  const isWin = participantData?.result === 'win'

  return (
    <div className="relative">
      <div
        className={`flex flex-row justify-between border-1 overflow-hidden  ${participant === 'opponent1' ? 'rounded-t-sm' : 'rounded-b-sm border-t-0'}`}
        style={{ height: bracketStyles.teamHeight }}
      >
        <div
          style={{ height: bracketStyles.teamHeight, lineHeight: `${bracketStyles.teamHeight}px` }}
          className="truncate px-1"
        >
          {participantData?.id != null ? participantsById[participantData.id]?.name : 'TBD'}
        </div>
        {participantData?.result && (
          <div
            className="text-center aspect-square "
            style={{
              width: bracketStyles.teamHeight - 1,
              lineHeight: `${bracketStyles.teamHeight}px`,
              backgroundColor: isWin ? bracketStyles.winScoreColor : bracketStyles.loseScoreColor,
            }}
          >
            {participantData.score ?? ''}
            <div
              className="absolute flex items-center justify-center"
              style={{
                left: bracketStyles.teamWidth + 4,
                top: 0,
                height: bracketStyles.teamHeight,
                lineHeight: `${bracketStyles.teamHeight}px`,
              }}
            >
              {(() => {
                const icon = bracketStyles.matchIcons[match.id]?.[isWin ? 'winner' : 'loser']
                return icon ? <icon.icon color={icon.color} /> : null
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MatchResultRow
