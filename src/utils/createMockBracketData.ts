import { BracketsManager } from 'brackets-manager'
import { InMemoryDatabase } from 'brackets-memory-db'
import { BracketData, BracketStyles } from '../types/types'
import type { Id, Match } from 'brackets-model'
import { FaTrophy } from 'react-icons/fa'
import { getBracketData } from './brackets'

const teams = [
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

export const bracketStyles: BracketStyles = {
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

const completedResults: { index: number; opponent1: number; opponent2: number }[] = [
  /* { index: 0, opponent1: 2, opponent2: 0 },
 { index: 1, opponent1: 2, opponent2: 1 },
  { index: 2, opponent1: 2, opponent2: 0 },
  { index: 3, opponent1: 1, opponent2: 2 },
  { index: 4, opponent1: 2, opponent2: 1 },
  { index: 5, opponent1: 0, opponent2: 2 },
  { index: 6, opponent1: 2, opponent2: 0 },
  { index: 7, opponent1: 2, opponent2: 0 },
  { index: 8, opponent1: 2, opponent2: 1 },
  { index: 9, opponent1: 2, opponent2: 0 },
  { index: 10, opponent1: 2, opponent2: 0 },
  { index: 11, opponent1: 0, opponent2: 2 },
  { index: 12, opponent1: 2, opponent2: 0 },
  { index: 13, opponent1: 2, opponent2: 0 },
  { index: 15, opponent1: 2, opponent2: 0 },
  { index: 16, opponent1: 2, opponent2: 0 },
  { index: 17, opponent1: 2, opponent2: 0 },
  { index: 18, opponent1: 0, opponent2: 2 },
  { index: 19, opponent1: 2, opponent2: 0 },
  { index: 20, opponent1: 2, opponent2: 0 },
  { index: 21, opponent1: 2, opponent2: 0 },
  { index: 22, opponent1: 2, opponent2: 0 },
  { index: 23, opponent1: 0, opponent2: 2 },
  { index: 24, opponent1: 2, opponent2: 0 },
  { index: 25, opponent1: 2, opponent2: 0 },
  { index: 26, opponent1: 0, opponent2: 2 },*/
]

// Skip matches, so we get top 4 teams
const matchIdsToSkip = new Set<Id>([14, 27, 28])

export const createMockBracketData = async (): Promise<BracketData> => {
  const storage = new InMemoryDatabase()
  const manager = new BracketsManager(storage)

  await manager.create.stage({
    tournamentId: 1,
    name: 'AG LoL Tournament',
    type: 'double_elimination',
    seeding: teams,
    settings: { grandFinal: 'simple', balanceByes: true, size: 16 },
  })

  const matches = ((await storage.select<Match>('match')) ?? []).sort(
    (a, b) => (a.id as number) - (b.id as number)
  )

  for (const result of completedResults) {
    const match = matches[result.index]

    if (!match || matchIdsToSkip.has(match.id)) continue

    const opponent1Won = result.opponent1 > result.opponent2

    const isBye = match.opponent1 === null || match.opponent2 === null

    if (isBye) {
      continue
    }

    await manager.update.match({
      id: match.id,
      opponent1: {
        score: result.opponent1,
        result: opponent1Won ? 'win' : 'loss',
      },
      opponent2: {
        score: result.opponent2,
        result: opponent1Won ? 'loss' : 'win',
      },
    })
  }

  return getBracketData(manager, matchIdsToSkip)
}
