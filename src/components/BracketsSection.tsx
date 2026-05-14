import type { BracketData, BracketStyles } from '../types/types'
import { getMatchesByRound, getParticipantsById, getRoundsByGroup } from '../utils/brackets'

import GroupSection from './BracketGroupSection'

type Props = {
  bracketStyles: BracketStyles
  data: BracketData
  isEditingMode: boolean
  onMatchResultSaved?: () => Promise<void>
  // When set, only these group labels are rendered. Default: both.
  visibleGroups?: ('Upper' | 'Lower')[]
}

const BracketsSection = ({
  bracketStyles,
  data,
  isEditingMode,
  onMatchResultSaved,
  visibleGroups,
}: Props) => {
  const roundsByGroup = getRoundsByGroup(data)
  const matchesByRound = getMatchesByRound(data)
  const participantsById = getParticipantsById(data)

  const showUpper = !visibleGroups || visibleGroups.includes('Upper')
  const showLower = !visibleGroups || visibleGroups.includes('Lower')

  return (
    <div
      style={{
        boxSizing: 'border-box',
        gap: bracketStyles.bracketGap,
        fontSize: bracketStyles.basicFontSize,
      }}
      className="flex flex-col"
    >
      {showUpper && (
        <GroupSection
          groupLabel="Upper"
          roundsByGroup={roundsByGroup}
          matchesByRound={matchesByRound}
          participantsById={participantsById}
          bracketStyles={bracketStyles}
          bracketData={data}
          isEditingMode={isEditingMode}
          onMatchResultSaved={onMatchResultSaved}
        />
      )}
      {showLower && (
        <GroupSection
          groupLabel="Lower"
          roundsByGroup={roundsByGroup}
          matchesByRound={matchesByRound}
          participantsById={participantsById}
          bracketStyles={bracketStyles}
          bracketData={data}
          isEditingMode={isEditingMode}
          onMatchResultSaved={onMatchResultSaved}
        />
      )}
    </div>
  )
}

export default BracketsSection
