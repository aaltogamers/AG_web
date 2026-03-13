import { BracketsManager } from 'brackets-manager'
import { InMemoryDatabase } from 'brackets-memory-db'
import { BracketData, BracketStyles } from '../types/types'
import type { Group, Id, Match, MatchGame, Participant, Round, Stage } from 'brackets-model'
import { FaCheck } from 'react-icons/fa'

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
  'Maroon',
  'Pink',
  'Turquoise',
]

export const bracketStyles: BracketStyles = {
  textColor: 'red',
  teamNameColor: '#4178c0',
  loseScoreColor: 'lightblue',
  winScoreColor: 'gold',
  roundColor: 'darkblue',
  connectorColor: 'black',
  titleFontSize: 24,
  basicFontSize: 16,
  teamHeight: 24,
  teamWidth: 140,
  teamGapX: 20,
  teamGapY: 10,
  bracketGap: 20,
  matchIcons: {
    12: { winner: { icon: FaCheck, color: 'green' } },
    13: { winner: { icon: FaCheck, color: 'green' } },
    25: { winner: { icon: FaCheck, color: 'green' } },
    26: { winner: { icon: FaCheck, color: 'green' } },
  },
}

const completedResults: { index: number; opponent1: number; opponent2: number }[] = [
  { index: 0, opponent1: 2, opponent2: 0 },
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
  { index: 26, opponent1: 0, opponent2: 2 },
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
    settings: { grandFinal: 'simple' },
  })

  const matches = ((await storage.select<{ id: number }>('match')) ?? []).sort(
    (a, b) => a.id - b.id
  )

  for (const result of completedResults) {
    const match = matches[result.index]

    if (!match || matchIdsToSkip.has(match.id)) continue

    const opponent1Won = result.opponent1 > result.opponent2

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

  const [stages, groups, rounds, updatedMatches, matchGames, participants] = await Promise.all([
    storage.select<Stage>('stage'),
    storage.select<Group>('group'),
    storage.select<Round>('round'),
    storage.select<Match>('match'),
    storage.select<MatchGame>('match_game'),
    storage.select<Participant>('participant'),
  ])

  const filteredMatches = (updatedMatches ?? []).filter((match) => !matchIdsToSkip.has(match.id))
  const filteredRoundIds = new Set(filteredMatches.map((match) => match.round_id))
  const filteredRounds = (rounds ?? []).filter((round) => filteredRoundIds.has(round.id))

  return {
    manager: manager,
    stages: stages ?? [],
    groups: groups ?? [],
    rounds: filteredRounds,
    matches: filteredMatches,
    matchGames: matchGames ?? [],
    participants: participants ?? [],
  }
}
