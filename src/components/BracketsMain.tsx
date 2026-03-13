import { useEffect, useState } from 'react'

import type { BracketData, BracketStyles, BracketType } from '../types/types'
import { setupBracket } from '../utils/brackets'

import BracketsSection from './BracketsSection'
import { InMemoryDatabase } from 'brackets-memory-db'
import { BracketsManager } from 'brackets-manager'
import { FaTrophy } from 'react-icons/fa'

const storage = new InMemoryDatabase()
const manager = new BracketsManager(storage)

const defaultTeams = [
  'Red',
  'Green',
  'Blue',
  'Magenta',
  'Yellow',
  'Orange',
  'Light Blue',
  'Violet',
  'Black',
  'Very Very Light Blueish Color',
  'Grey',
  'Aquamarine',
  'Brown',
]

const defaultBracketStyles: BracketStyles = {
  textColor: '#ECFEE8',
  teamNameColor: '#41337A',
  loseScoreColor: '#6EA4BF',
  winScoreColor: '#FAA916',
  roundColor: '#331E36',
  dividerColor: '#331E36',
  connectorColor: '#FAA916',
  titleFontSize: 24,
  basicFontSize: 16,
  teamHeight: 24,
  teamWidth: 140,
  teamGapX: 20,
  teamGapY: 10,
  bracketGap: 20,
  matchIcons: {
    12: { winner: { icon: FaTrophy, color: '#FAA916' } },
    13: { winner: { icon: FaTrophy, color: '#FAA916' } },
    25: { winner: { icon: FaTrophy, color: '#FAA916' } },
    26: { winner: { icon: FaTrophy, color: '#FAA916' } },
  },
}

const BracketsMain = () => {
  const [data, setData] = useState<BracketData[]>([])
  const [teams, _setTeams] = useState<string[]>([...defaultTeams])
  const [teamCount, _setTeamCount] = useState<4 | 8 | 16 | 32 | 64>(16)
  const [bracketStyles, _setBracketStyles] = useState<BracketStyles>({ ...defaultBracketStyles })
  const [bracketType, _setBracketType] = useState<BracketType>('double_elimination_to_top_4')

  useEffect(() => {
    const loadBracket = async () => {
      const newData = await setupBracket(manager, bracketType, teamCount, teams)

      setData(newData)
    }

    loadBracket()
  }, [])

  return (
    <div className="flex flex-row">
      {data.map((bracketData) => (
        <BracketsSection
          key={bracketData.stages[0].id}
          data={bracketData}
          bracketStyles={bracketStyles}
        />
      ))}
    </div>
  )
}

export default BracketsMain
