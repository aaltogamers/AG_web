import { useEffect, useState } from 'react'
import { BracketsManager } from 'brackets-manager'
import { InMemoryDatabase } from 'brackets-memory-db'
import type { Group, Id, Match, MatchGame, Participant, Round, Stage } from 'brackets-model'

import { FaCheck, FaMedal } from 'react-icons/fa'
import { BracketStyles } from '../types/types'
import MatchResultRow from './BracketMatchResultRow'

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

const bracketStyles: BracketStyles = {
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
    12: { winner: { icon: FaMedal, color: 'green' } },
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
    stages: stages ?? [],
    groups: groups ?? [],
    rounds: filteredRounds,
    matches: filteredMatches,
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
  const matchHeight = bracketStyles.teamHeight * 2
  const baseGap = bracketStyles.teamGapY

  return (
    <div className="flex flex-row" style={{ color: bracketStyles.textColor }}>
      {roundsByGroup[groupLabel]?.map((round, i) => {
        const roundMatches = matchesByRound[round.id] ?? []

        const roundDepth = groupLabel === 'Lower' ? Math.floor(i / 2) : i
        const roundMultiplier = 2 ** roundDepth
        const roundGap = baseGap * roundMultiplier + matchHeight * (roundMultiplier - 1)
        const roundOffset = roundGap / 2

        const nextRound = roundsByGroup[groupLabel]?.[i + 1]
        const nextRoundMatches = nextRound ? (matchesByRound[nextRound.id] ?? []) : []
        const hasNextRound = nextRound != null
        const shouldMergePairs = hasNextRound && roundMatches.length === nextRoundMatches.length * 2

        const connectorThickness = 2
        const connectorHalfGap = bracketStyles.teamGapX / 2
        const connectorFullGap = bracketStyles.teamGapX

        const matchCenter = matchHeight / 2
        const nextMatchCenterDistance = matchHeight + roundGap

        const gameNumberTextSpace = 12

        return (
          <div key={round.id} className="flex flex-col">
            <h3
              className="mb-4 text-xl font-bold text-center px-1 rounded-sm"
              style={{
                backgroundColor: bracketStyles.roundColor,
                marginRight: 1,
                marginLeft: 1,
                fontSize: bracketStyles.titleFontSize,
              }}
            >
              {roundToLabel(round)}
            </h3>
            <div
              className="flex flex-col"
              style={{
                gap: roundGap,
                marginTop: roundOffset,
                marginBottom: roundOffset,
                marginRight: bracketStyles.teamGapX,
              }}
            >
              {roundMatches.map((match, matchIndex) => (
                <div
                  key={match.id}
                  className="relative flex flex-col rounded-sm"
                  style={{
                    backgroundColor: bracketStyles.teamNameColor,
                    width: bracketStyles.teamWidth,
                    marginLeft: gameNumberTextSpace,
                  }}
                >
                  <MatchResultRow
                    match={match}
                    participant="opponent1"
                    participantsById={participantsById}
                    bracketStyles={bracketStyles}
                  />

                  <MatchResultRow
                    match={match}
                    participant="opponent2"
                    participantsById={participantsById}
                    bracketStyles={bracketStyles}
                  />

                  <div
                    style={{
                      position: 'absolute',
                      lineHeight: `${bracketStyles.basicFontSize}px`,
                      fontSize: bracketStyles.basicFontSize * 0.75,
                      color: bracketStyles.connectorColor,
                      top: matchCenter - connectorThickness / 2 - bracketStyles.basicFontSize / 2,
                      textAlign: 'right',
                      left: '-22px',
                      width: '20px',
                    }}
                  >
                    {match.id}
                  </div>

                  {hasNextRound && shouldMergePairs && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          left: bracketStyles.teamWidth,
                          top: matchCenter - connectorThickness / 2,
                          width: connectorHalfGap,
                          height: connectorThickness,
                          backgroundColor: bracketStyles.connectorColor,
                        }}
                      />

                      {matchIndex % 2 === 0 && matchIndex + 1 < roundMatches.length && (
                        <>
                          <div
                            style={{
                              position: 'absolute',
                              left:
                                bracketStyles.teamWidth + connectorHalfGap - connectorThickness / 2,
                              top: matchCenter,
                              width: connectorThickness,
                              height: nextMatchCenterDistance,
                              backgroundColor: bracketStyles.connectorColor,
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              left: bracketStyles.teamWidth + connectorHalfGap,
                              top:
                                matchCenter + nextMatchCenterDistance / 2 - connectorThickness / 2,
                              width: connectorHalfGap,
                              height: connectorThickness,
                              backgroundColor: bracketStyles.connectorColor,
                            }}
                          />
                        </>
                      )}
                    </>
                  )}

                  {hasNextRound && !shouldMergePairs && (
                    <div
                      style={{
                        position: 'absolute',
                        left: bracketStyles.teamWidth,
                        top: matchCenter - connectorThickness / 2,
                        width: connectorFullGap,
                        height: connectorThickness,
                        backgroundColor: bracketStyles.connectorColor,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
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
