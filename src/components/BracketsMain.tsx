import { useEffect, useState } from 'react'

import type { BracketData, BracketStyles } from '../types/types'
import { getBracketData, getTopFourTeamsFromDoubleElimQualifiers } from '../utils/brackets'

import BracketsSection from './BracketsSection'
import { InMemoryDatabase } from 'brackets-memory-db'
import { BracketsManager } from 'brackets-manager'

type Props = {
  bracketStyles: BracketStyles
  teams: string[]
  teamCount: 4 | 8 | 16 | 32 | 64
  bracketType: 'single_elimination' | 'double_elimination' | 'double_elimination_to_top_4'
}

const BracketsMain = ({ bracketStyles, teams, teamCount, bracketType }: Props) => {
  const storage = new InMemoryDatabase()
  const manager = new BracketsManager(storage)

  const [mainBracketData, setMainData] = useState<BracketData | null>(null)
  const [finalBracketData, setFinalData] = useState<BracketData | null>(null)

  useEffect(() => {
    const loadBracket = async () => {
      if (bracketType !== 'double_elimination_to_top_4') {
        throw Error('Only double_elimination_to_top_4 type supported currently')
      }

      if (teamCount !== 16) {
        throw Error('Only 16 teams supported currently')
      }

      const qualifierStage = await manager.create.stage({
        tournamentId: 1,
        name: 'Qualifier stage',
        type: 'double_elimination',
        seeding: teams,
        settings: { grandFinal: 'simple', balanceByes: true, size: teamCount },
      })

      // TODO: Make support other than 16 teams
      const matchIdsToSkip = new Set([14, 27, 28])

      const mainBracketData = await getBracketData(manager, qualifierStage.id, matchIdsToSkip)

      const topFourTeams = getTopFourTeamsFromDoubleElimQualifiers(mainBracketData)

      const finalsStage = await manager.create.stage({
        tournamentId: 1,
        name: 'Final stage',
        type: 'single_elimination',
        seeding:
          topFourTeams.length === 4
            ? topFourTeams.map((item) => item.name)
            : [' ', '  ', '   ', '    '], // Very hacky
        settings: { grandFinal: 'simple' },
      })

      const finalsBracketData = await getBracketData(manager, finalsStage.id, new Set())

      setMainData(mainBracketData)
      setFinalData(finalsBracketData)
    }

    loadBracket()
  }, [])

  if (!mainBracketData) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex flex-row">
      <BracketsSection data={mainBracketData} bracketStyles={bracketStyles} />
      {finalBracketData && (
        <BracketsSection data={finalBracketData} bracketStyles={bracketStyles} />
      )}
    </div>
  )
}

export default BracketsMain
