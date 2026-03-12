import { useEffect, useState } from 'react'
import { BracketsManager } from 'brackets-manager'
import { InMemoryDatabase } from 'brackets-memory-db'
import type { Group, Id, Match, MatchGame, Participant, Round, Stage } from 'brackets-model'

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

const styles = {
  textColor: 'red',
  lightColor: 'lightblue',
  mediumColor: '#4178c0',
  darkColor: 'darkblue',
  winColor: 'gold',
  teamHeight: 24,
  teamWidth: 140,
  teamGapX: 20,
  teamGapY: 20,
  bracketGap: 20,
}

const completedResults: { index: number; opponent1: number; opponent2: number }[] = [
  { index: 0, opponent1: 2, opponent2: 0 },
  { index: 1, opponent1: 2, opponent2: 1 },
  { index: 2, opponent1: 2, opponent2: 0 },
  { index: 3, opponent1: 1, opponent2: 2 },
  { index: 4, opponent1: 2, opponent2: 1 },
  { index: 5, opponent1: 0, opponent2: 2 },
  { index: 8, opponent1: 2, opponent2: 1 },
]

type BracketData = {
  stages: Stage[]
  groups: Group[]
  rounds: Round[]
  matches: Match[]
  matchGames: MatchGame[]
  participants: Participant[]
}

const createBracketData = async (): Promise<BracketData> => {
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

    if (!match) continue

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

  return {
    stages: stages ?? [],
    groups: groups ?? [],
    rounds: rounds ?? [],
    matches: updatedMatches ?? [],
    matchGames: matchGames ?? [],
    participants: participants ?? [],
  }
}

const groupToLabel = (groupId: Id) => {
  switch (groupId) {
    case 0:
      return 'Upper'
    case 1:
      return 'Lower'
    case 2:
      return `Final`
    default:
      return `Unknown`
  }
}

const roundToLabel = (round: Round) => {
  const groupLabel = groupToLabel(round.group_id)

  if (groupLabel === 'Final') {
    return groupLabel
  }

  if (groupLabel === 'Upper') {
    return `Round ${round.number}`
  }

  return `${groupLabel} Round ${round.number}`
}

const MatchResultRow = (
  match: Match,
  participant: 'opponent1' | 'opponent2',
  participantsById: Record<Id, Participant>
) => {
  const participantData = match[participant]

  const isWin = participantData?.result === 'win'

  return (
    <div
      className={`flex flex-row justify-between border-1 ${participant === 'opponent1' ? 'rounded-t-sm' : 'rounded-b-sm border-t-0'}`}
    >
      <div
        style={{ height: styles.teamHeight, lineHeight: `${styles.teamHeight}px` }}
        className="truncate px-1"
      >
        {participantData?.id != null ? participantsById[participantData.id]?.name : 'TBD'}
      </div>

      <div
        className={`text-center aspect-square ${participant === 'opponent1' ? 'rounded-t-sm' : 'rounded-b-sm'}`}
        style={{
          width: styles.teamHeight,
          height: styles.teamHeight,
          lineHeight: `${styles.teamHeight}px`,
          backgroundColor: isWin ? styles.winColor : styles.lightColor,
        }}
      >
        {participantData?.score != null ? participantData.score : ''}
      </div>
    </div>
  )
}

const GroupSection = ({
  groupLabel,
  roundsByGroup,
  matchesByRound,
  participantsById,
}: {
  groupLabel: string
  roundsByGroup: Record<string, Round[]>
  matchesByRound: Record<Id, Match[]>
  participantsById: Record<Id, Participant>
}) => {
  return (
    <div className="flex flex-row" style={{ color: styles.textColor }}>
      {roundsByGroup[groupLabel]?.map((round, i) => (
        <div key={round.id} className="flex flex-col">
          <h3
            className="mb-4 text-xl font-bold text-center px-1 rounded-sm"
            style={{
              backgroundColor: styles.darkColor,
              marginRight: 1,
              marginLeft: 1,
              width: styles.teamWidth,
            }}
          >
            {roundToLabel(round)}
          </h3>
          <div
            className="flex flex-col gap-4 flex-auto justify-between"
            style={{
              marginTop: i * styles.teamHeight * 2,
              marginBottom: i * styles.teamHeight * 2,
              marginRight: styles.teamGapX,
            }}
          >
            {matchesByRound[round.id]?.map((match) => (
              <div
                key={match.id}
                className="flex flex-col rounded-sm"
                style={{ backgroundColor: styles.mediumColor, width: styles.teamWidth }}
              >
                {MatchResultRow(match, 'opponent1', participantsById)}
                {MatchResultRow(match, 'opponent2', participantsById)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const BracketsSection = () => {
  const [data, setData] = useState<BracketData | null>(null)

  useEffect(() => {
    const loadBracket = async () => {
      const bracketData = await createBracketData()

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
    <div style={{ boxSizing: 'border-box', gap: styles.bracketGap }} className="flex flex-col">
      <GroupSection
        groupLabel="Upper"
        roundsByGroup={roundsByGroup}
        matchesByRound={matchesByRound}
        participantsById={participantsById}
      />
      <GroupSection
        groupLabel="Lower"
        roundsByGroup={roundsByGroup}
        matchesByRound={matchesByRound}
        participantsById={participantsById}
      />
    </div>
  )
}

export default BracketsSection
