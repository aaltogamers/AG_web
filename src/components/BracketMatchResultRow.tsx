import { Id, Match, Participant, Status } from 'brackets-model'
import { BracketData, BracketStyles, OpponentFroMatch } from '../types/types'
import { FaMedal, FaTrophy } from 'react-icons/fa'

type Props = {
  match: Match
  participant: 'opponent1' | 'opponent2'
  participantsById: Record<Id, Participant>
  bracketStyles: BracketStyles
  waitingForMatchId?: Id | null
  waitingForMatchType?: 'winner' | 'loser'
  feedInfo?: OpponentFroMatch
  bracketData: Pick<BracketData, 'matchIds' | 'placeholderParticipantIds' | 'matchNumbers'>
}

const PRIZE_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
}

const QUALIFYING_ICON = { icon: FaMedal }
//const THIRD_PLACE_ICON = { icon: FaMedal, color: PRIZE_COLORS.bronze }
const SECOND_PLACE_ICON = { icon: FaMedal, color: PRIZE_COLORS.silver }
const FIRST_PLACE_ICON = { icon: FaTrophy, color: PRIZE_COLORS.gold }

const MatchResultRow = ({
  match,
  participant,
  participantsById,
  bracketStyles,
  feedInfo,
  bracketData,
}: Props) => {
  const participantData = match[participant]

  const isBye = match.opponent1 === null || match.opponent2 === null

  const isWin = participantData?.result === 'win'

  // Shown once per match, above its first row, so live scores aren't mistaken for final ones
  const showLiveBadge = participant === 'opponent1' && match.status === Status.Running && !isBye

  const tbdLabel = feedInfo ? (
    feedInfo.outcome === 'loser' ? (
      <i className="opacity-75" style={{ fontSize: '0.9em' }}>
        Loser of match {bracketData.matchNumbers?.[feedInfo.match.id] ?? feedInfo.match.id}
      </i>
    ) : (
      ''
    )
  ) : (
    ''
  )

  return (
    <div className="relative">
      {showLiveBadge && (
        <div
          className="absolute z-20 flex items-center gap-0.5 rounded-sm bg-red-600 px-1 font-bold text-white"
          // Straddles the card's top edge so it stays clear of the match above
          style={{ top: -6, right: 2, fontSize: 8, lineHeight: '11px' }}
        >
          <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
          LIVE
        </div>
      )}
      <div
        className={`flex flex-row justify-between  overflow-hidden`}
        style={{ height: bracketStyles.teamHeight }}
      >
        {participant === 'opponent2' && (
          <div
            className="absolute w-full "
            style={{ height: 1, backgroundColor: bracketStyles.dividerColor }}
          />
        )}
        <div
          style={{
            height: bracketStyles.teamHeight,
            lineHeight: `${bracketStyles.teamHeight}px`,
          }}
          className="truncate px-1"
        >
          {participantData === null ? (
            <i className="opacity-75" style={{ fontSize: '0.8em' }}>
              BYE
            </i>
          ) : participantData?.id === null ? (
            tbdLabel
          ) : bracketData.placeholderParticipantIds?.has(participantData.id) ? (
            <i className="opacity-50" style={{ fontSize: '0.9em' }}>
              {participantsById[participantData.id]?.name}
            </i>
          ) : (
            participantsById[participantData.id]?.name
          )}
        </div>
        {participantData?.score != undefined && !isBye && (
          <div
            className="text-center aspect-square rounded-r-sm"
            style={{
              width: bracketStyles.teamHeight - 1,
              lineHeight: `${bracketStyles.teamHeight}px`,
              backgroundColor: isWin ? bracketStyles.winScoreColor : bracketStyles.loseScoreColor,
            }}
          >
            {participantData.score}

            {participantData.result && (
              <div
                className="absolute flex items-center justify-center z-10"
                style={{
                  left: bracketStyles.teamWidth + 4,
                  top: 0,
                  height: bracketStyles.teamHeight,
                  lineHeight: `${bracketStyles.teamHeight}px`,
                }}
              >
                {(() => {
                  let icon: {
                    icon: React.ComponentType<{ color?: string }>
                    color?: string
                  } | null = null

                  if (bracketData.matchIds.qualifying?.has(match.id) && isWin) {
                    icon = QUALIFYING_ICON
                  }

                  /*
                  if (bracketData.matchIds.bronze?.has(match.id) && !isWin) {
                    icon = THIRD_PLACE_ICON
                  }*/

                  if (bracketData.matchIds.silver?.has(match.id) && !isWin) {
                    icon = SECOND_PLACE_ICON
                  }

                  if (bracketData.matchIds.gold?.has(match.id) && isWin) {
                    icon = FIRST_PLACE_ICON
                  }

                  return icon ? (
                    <icon.icon color={icon.color || bracketStyles.winScoreColor} />
                  ) : null
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MatchResultRow
