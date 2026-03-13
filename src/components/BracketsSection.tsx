import type { BracketData, BracketStyles } from '../types/types'
import { getMatchesByRound, getParticipantsById, getRoundsByGroup } from '../utils/brackets'

import GroupSection from './BracketGroupSection'

type Props = { bracketStyles: BracketStyles; data: BracketData; isEditingMode: boolean }

const BracketsSection = ({ bracketStyles, data, isEditingMode }: Props) => {
  const roundsByGroup = getRoundsByGroup(data)
  const matchesByRound = getMatchesByRound(data)
  const participantsById = getParticipantsById(data)

  return (
    <div
      style={{
        boxSizing: 'border-box',
        gap: bracketStyles.bracketGap,
        fontSize: bracketStyles.basicFontSize,
      }}
      className="flex flex-col"
    >
      <GroupSection
        groupLabel="Upper"
        roundsByGroup={roundsByGroup}
        matchesByRound={matchesByRound}
        participantsById={participantsById}
        bracketStyles={bracketStyles}
        bracketData={data}
        isEditingMode={isEditingMode}
      />
      <GroupSection
        groupLabel="Lower"
        roundsByGroup={roundsByGroup}
        matchesByRound={matchesByRound}
        participantsById={participantsById}
        bracketStyles={bracketStyles}
        bracketData={data}
        isEditingMode={isEditingMode}
      />
    </div>
  )
}

export default BracketsSection
