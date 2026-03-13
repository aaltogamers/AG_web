import { useEffect, useState } from 'react'

import type { BracketData, BracketStyles } from '../types/types'
import { getTopFourTeamsFromDoubleElimQualifiers } from '../utils/brackets'
import { createMockBracketData } from '../utils/createMockBracketData'

import BracketsSection from './BracketsSection'
import { Group, Match, MatchGame, Participant, Round, Stage } from 'brackets-model'
import { InMemoryDatabase } from 'brackets-memory-db'
import { BracketsManager } from 'brackets-manager'

type Props = {
  bracketStyles: BracketStyles
}

const BracketsMain = ({ bracketStyles }: Props) => {
  const [data, setData] = useState<{
    mainBracket: BracketData | null
    finalBracket: BracketData | null
  }>({
    mainBracket: null,
    finalBracket: null,
  })

  useEffect(() => {
    const loadBracket = async () => {
      const mainBracket = await createMockBracketData()

      const storage = new InMemoryDatabase()
      const manager = new BracketsManager(storage)

      const topFourTeams = getTopFourTeamsFromDoubleElimQualifiers(mainBracket)

      await manager.create.stage({
        tournamentId: 1,
        name: 'AG LoL Tournament',
        type: 'single_elimination',
        seeding: topFourTeams.map((item) => item.name),
        settings: { grandFinal: 'simple' },
      })

      const [stages, groups, rounds, matches, matchGames, participants] = await Promise.all([
        storage.select<Stage>('stage'),
        storage.select<Group>('group'),
        storage.select<Round>('round'),
        storage.select<Match>('match'),
        storage.select<MatchGame>('match_game'),
        storage.select<Participant>('participant'),
      ])

      const finalBracket = {
        manager: manager,
        stages: stages ?? [],
        groups: groups ?? [],
        rounds: rounds ?? [],
        matches: matches ?? [],
        matchGames: matchGames ?? [],
        participants: participants ?? [],
      }

      setData({ mainBracket, finalBracket })
    }

    loadBracket()
  }, [])

  if (!data.mainBracket) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex flex-row">
      <BracketsSection data={data.mainBracket} bracketStyles={bracketStyles} />
      {data.finalBracket && (
        <BracketsSection data={data.finalBracket} bracketStyles={bracketStyles} />
      )}
    </div>
  )
}

export default BracketsMain
