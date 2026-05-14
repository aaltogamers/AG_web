'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { BracketData, BracketStyles, BracketType } from '../types/types'
import { createBracket, getBracketsData } from '../utils/brackets'

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
  'Beige',
  'Crimson',
  'Cyan',
  'Ultramarine',
  'Some very cool color',
  'Lime Green',
]

const defaultBracketStyles: BracketStyles = {
  textColor: '#e8fefb',
  teamNameColor: '#41337A',
  loseScoreColor: '#6EA4BF',
  winScoreColor: '#FAA916',
  roundColor: '#211e36',
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
  const [teams] = useState<string[]>([...defaultTeams])
  const [teamCount] = useState<8 | 16 | 32 | 64>(32)
  const [bracketStyles] = useState<BracketStyles>({ ...defaultBracketStyles })
  const [bracketType] = useState<BracketType>('double_elimination_to_top_4')

  const isEditingMode: boolean = true
  const dataRef = useRef(data)
  dataRef.current = data

  const refreshBrackets = useCallback(async () => {
    const current = dataRef.current

    if (current.length === 2) {
      const [qualifier, finals] = current
      const newData = await getBracketsData(
        manager,
        qualifier.stages[0].id,
        finals.stages[0].id,
        teamCount
      )
      setData(newData)
    } else {
      const newData = await createBracket(manager, bracketType, teamCount, teams)
      setData(newData)
    }
  }, [bracketType, teamCount, teams])

  useEffect(() => {
    refreshBrackets()
  }, [])

  return (
    <div className="flex flex-row">
      {data.map((bracketData) => (
        <BracketsSection
          key={bracketData.stages[0].id}
          data={bracketData}
          bracketStyles={bracketStyles}
          isEditingMode={isEditingMode}
          onMatchResultSaved={refreshBrackets}
        />
      ))}
    </div>
  )
}

export default BracketsMain
