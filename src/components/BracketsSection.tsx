import { useEffect, useState } from 'react'

import type { BracketData, BracketStyles } from '../types/types'
import {
  getMatchesByRound,
  getParticipantsById,
  getRoundsByGroup,
  getTopFourTeamsFromDoubleElimQualifiers,
} from '../utils/brackets'
import { createMockBracketData } from '../utils/createMockBracketData'
import GroupSection from './BracketGroupSection'

type Props = {
  bracketStyles: BracketStyles
}

const BracketsSection = ({ bracketStyles }: Props) => {
  const [data, setData] = useState<BracketData | null>(null)

  useEffect(() => {
    const loadBracket = async () => {
      const bracketData = await createMockBracketData()

      setData(bracketData)

      console.log(getTopFourTeamsFromDoubleElimQualifiers(bracketData))
    }

    loadBracket()
  }, [])

  if (!data) {
    return <div>Loading...</div>
  }

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
      />
      <GroupSection
        groupLabel="Lower"
        roundsByGroup={roundsByGroup}
        matchesByRound={matchesByRound}
        participantsById={participantsById}
        bracketStyles={bracketStyles}
      />
    </div>
  )
}

export default BracketsSection
