import { useEffect, useState } from 'react'

import type { BracketData, BracketStyles } from '../types/types'
import { getBracketData, getTopFourTeamsFromDoubleElimQualifiers } from '../utils/brackets'
import { createMockBracketData } from '../utils/createMockBracketData'

import BracketsSection from './BracketsSection'
import { Group, Match, MatchGame, Participant, Round, Stage } from 'brackets-model'
import { InMemoryDatabase } from 'brackets-memory-db'
import { BracketsManager } from 'brackets-manager'

type Props = {
  bracketStyles: BracketStyles
}

const BracketsMain = ({ bracketStyles }: Props) => {
  const [mainBracketData, setMainData] = useState<BracketData | null>(null)
  const [finalBracketData, setFinalData] = useState<BracketData | null>(null)

  useEffect(() => {
    const loadBracket = async () => {
      const mainBracket = await createMockBracketData()
      setMainData(mainBracket)
    }

    loadBracket()
  }, [])

  useEffect(() => {
    const loadBracket = async () => {
      if (!mainBracketData) {
        return
      }

      const storage = new InMemoryDatabase()
      const manager = new BracketsManager(storage)

      const topFourTeams = getTopFourTeamsFromDoubleElimQualifiers(mainBracketData)

      setMainData(mainBracketData)

      await manager.create.stage({
        tournamentId: 1,
        name: 'AG LoL Tournament',
        type: 'single_elimination',
        seeding:
          topFourTeams.length === 4
            ? topFourTeams.map((item) => item.name)
            : [' ', '  ', '   ', '    '], // Very hacky
        settings: { grandFinal: 'simple' },
      })

      setFinalData(await getBracketData(manager, new Set()))
    }

    loadBracket()
  }, [mainBracketData])

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
