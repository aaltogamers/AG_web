import { useEffect, useState } from 'react'

import type { Id, Match, Participant, Round } from 'brackets-model'

import { BracketData, BracketStyles } from '../types/types'
import { groupToLabel } from '../utils/brackets'
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
    }

    loadBracket()
  }, [])

  if (!data) {
    return <div>Loading...</div>
  }

  const roundsByGroup: Record<Id, Round[]> = {}

  for (const round of data.rounds) {
    const groupLabel = groupToLabel(round.group_id)

    if (!roundsByGroup[groupLabel]) {
      roundsByGroup[groupLabel] = []
    }

    roundsByGroup[groupLabel].push(round)
  }

  const matchesByRound: Record<Id, Match[]> = {}

  for (const match of data.matches) {
    if (!matchesByRound[match.round_id]) {
      matchesByRound[match.round_id] = []
    }

    matchesByRound[match.round_id].push(match)
  }

  const participantsById: Record<Id, Participant> = {}

  for (const participant of data.participants) {
    participantsById[participant.id] = participant
  }

  if (data.groups.length !== 3) {
    return <div>Only double elim with grand final is currently supported</div>
  }

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
