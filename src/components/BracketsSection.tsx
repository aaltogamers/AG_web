import { useEffect, useState } from 'react'
import { BracketsManager } from 'brackets-manager'
import { InMemoryDatabase } from 'brackets-memory-db'
import type { Group, Id, Match, MatchGame, Participant, Round, Stage } from 'brackets-model'
import { Status } from 'brackets-model'

const teams = [
  'Aalto Afterparty',
  'Barracks Boosters',
  'Crit Farmers',
  'Dragon Callers',
  'Echo Squad',
  'First Blood',
  'GGWP United',
  'Lanlords',
]

const completedResults = [
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

type MatchView = Match & {
  groupNumber: number
  roundNumber: number
  groupLabel: string
  roundLabel: string
  matchLabel: string
}

const statusLabels: Record<Status, string> = {
  [Status.Locked]: 'Locked',
  [Status.Waiting]: 'Waiting',
  [Status.Ready]: 'Ready',
  [Status.Running]: 'Live',
  [Status.Completed]: 'Final',
  [Status.Archived]: 'Archived',
}

const upperRoundGapClasses = ['gap-4', 'gap-16', 'gap-28', 'gap-36']
const lowerRoundGapClasses = ['gap-4', 'gap-8', 'gap-12', 'gap-16', 'gap-20', 'gap-24']
const finalRoundGapClasses = ['gap-6', 'gap-10']

const createBracketData = async (): Promise<BracketData> => {
  const storage = new InMemoryDatabase()
  const manager = new BracketsManager(storage)

  await manager.create.stage({
    tournamentId: 1,
    name: 'AG Spring Championship',
    type: 'double_elimination',
    seeding: teams,
    settings: { grandFinal: 'double' },
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

const formatOpponentName = (
  match: Match | null,
  side: 'opponent1' | 'opponent2',
  data: BracketData | null
) => {
  if (!match || !data) return 'TBD'

  const opponent = match[side]

  if (!opponent) return 'TBD'

  if (opponent.id !== null && opponent.id !== undefined) {
    const participant = data.participants.find(({ id }) => id === opponent.id)

    if (participant) return participant.name
  }

  if (opponent.position) return `Seed ${opponent.position}`

  return 'TBD'
}

const formatScore = (value?: number | null) => (value === null || value === undefined ? '-' : value)

const getGroupLabel = (groupNumber: number) => {
  if (groupNumber === 1) return 'Upper bracket'
  if (groupNumber === 2) return 'Lower bracket'
  return 'Grand final'
}

const getRoundLabel = (groupNumber: number, roundNumber: number, roundCount: number) => {
  if (groupNumber === 1) {
    if (roundNumber === roundCount) return 'Upper final'
    if (roundNumber === roundCount - 1) return 'Upper semi'
    return `Upper round ${roundNumber}`
  }

  if (groupNumber === 2) {
    if (roundNumber === roundCount) return 'Lower final'
    if (roundNumber === roundCount - 1) return 'Lower semi'
    return `Lower round ${roundNumber}`
  }

  return roundNumber === 1 ? 'Grand final' : `Grand final reset ${roundNumber}`
}

const getRoundGapClass = (groupNumber: number, roundIndex: number) => {
  if (groupNumber === 1) return upperRoundGapClasses[roundIndex] ?? 'gap-36'
  if (groupNumber === 2) return lowerRoundGapClasses[roundIndex] ?? 'gap-24'
  return finalRoundGapClasses[roundIndex] ?? 'gap-10'
}

const getStatusTone = (status: Status) => {
  if (status === Status.Completed) return 'border-red/40 bg-red/10 text-red'
  if (status === Status.Running) return 'border-red/40 bg-red/15 text-white'
  if (status === Status.Ready) return 'border-white/15 bg-white/5 text-white'
  return 'border-white/10 bg-black/40 text-lightgray'
}

const getParticipantTone = (result?: string) => {
  if (result === 'win') return 'bg-red/10 text-white'
  if (result === 'loss') return 'opacity-75'
  return ''
}

const buildMatchViews = (data: BracketData) => {
  const roundsById = new Map(data.rounds.map((round) => [round.id, round]))
  const groupsById = new Map(data.groups.map((group) => [group.id, group]))
  const roundCountByGroup = new Map<Id, number>()

  data.rounds.forEach((round) => {
    roundCountByGroup.set(
      round.group_id,
      Math.max(roundCountByGroup.get(round.group_id) ?? 0, round.number)
    )
  })

  return data.matches
    .map((match) => {
      const round = roundsById.get(match.round_id)
      const group = groupsById.get(match.group_id)

      if (!round || !group) return null

      const roundCount = roundCountByGroup.get(group.id) ?? round.number

      return {
        ...match,
        groupNumber: group.number,
        roundNumber: round.number,
        groupLabel: getGroupLabel(group.number),
        roundLabel: getRoundLabel(group.number, round.number, roundCount),
        matchLabel: `M${round.number}.${match.number}`,
      }
    })
    .filter((match): match is MatchView => match !== null)
}

const groupMatchesByRound = (matches: MatchView[], groupNumber: number) => {
  const rounds = new Map<number, MatchView[]>()

  matches
    .filter((match) => match.groupNumber === groupNumber)
    .sort((a, b) => a.roundNumber - b.roundNumber || a.number - b.number)
    .forEach((match) => {
      const existing = rounds.get(match.roundNumber) ?? []
      existing.push(match)
      rounds.set(match.roundNumber, existing)
    })

  return Array.from(rounds.entries()).map(([roundNumber, roundMatches]) => ({
    roundNumber,
    roundLabel: roundMatches[0].roundLabel,
    matches: roundMatches,
  }))
}

const MatchCard = ({
  match,
  isSelected,
  onSelect,
  data,
}: {
  match: MatchView
  isSelected: boolean
  onSelect: (match: MatchView) => void
  data: BracketData | null
}) => (
  <button
    type="button"
    onClick={() => onSelect(match)}
    className={[
      'w-72 rounded-2xl border p-4 text-left transition duration-150 ease-in-out',
      'bg-[linear-gradient(180deg,rgba(35,36,45,0.96),rgba(28,29,38,0.96))] shadow-[0_12px_30px_rgba(0,0,0,0.22)]',
      isSelected
        ? 'border-red shadow-[0_16px_36px_rgba(243,41,41,0.18)]'
        : 'border-white/10 hover:border-red/60 hover:-translate-y-0.5',
    ].join(' ')}
  >
    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-lightgray">
      <span>{match.matchLabel}</span>
      <span
        className={[
          'rounded-full border px-2 py-1 tracking-[0.18em]',
          getStatusTone(match.status),
        ].join(' ')}
      >
        {statusLabels[match.status]}
      </span>
    </div>
    <div className="mt-4 space-y-2">
      <div
        className={[
          'flex items-center justify-between gap-3 rounded-xl border border-white/8 px-3 py-3',
          getParticipantTone(match.opponent1?.result),
        ].join(' ')}
      >
        <span className="truncate pr-3 text-base">
          {formatOpponentName(match, 'opponent1', data)}
        </span>
        <span className="text-xl font-semibold text-red">
          {formatScore(match.opponent1?.score)}
        </span>
      </div>
      <div
        className={[
          'flex items-center justify-between gap-3 rounded-xl border border-white/8 px-3 py-3',
          getParticipantTone(match.opponent2?.result),
        ].join(' ')}
      >
        <span className="truncate pr-3 text-base">
          {formatOpponentName(match, 'opponent2', data)}
        </span>
        <span className="text-xl font-semibold text-red">
          {formatScore(match.opponent2?.score)}
        </span>
      </div>
    </div>
  </button>
)

const RoundColumns = ({
  title,
  rounds,
  data,
  selectedMatchId,
  onSelect,
}: {
  title: string
  rounds: Array<{ roundNumber: number; roundLabel: string; matches: MatchView[] }>
  data: BracketData | null
  selectedMatchId?: Id
  onSelect: (match: MatchView) => void
}) => (
  <section className="rounded-3xl border border-white/10 bg-darkgray/70 p-5 backdrop-blur-sm">
    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
      <h3 className="font-blockletter text-xl uppercase tracking-[0.16em] text-white">{title}</h3>
      <span className="text-xs uppercase tracking-[0.22em] text-lightgray">
        {rounds.length} rounds
      </span>
    </div>
    <div className="mt-6 overflow-x-auto pb-2">
      <div className="flex min-w-max items-start gap-6 pr-2">
        {rounds.map((round, roundIndex) => (
          <div key={`${title}-${round.roundNumber}`} className="w-72 shrink-0">
            <div className="mb-4 rounded-2xl border border-red/25 bg-red/10 px-4 py-3 text-center">
              <p className="font-blockletter text-sm uppercase tracking-[0.22em] text-red">
                {round.roundLabel}
              </p>
            </div>
            <div
              className={[
                'flex flex-col',
                getRoundGapClass(round.matches[0].groupNumber, roundIndex),
              ].join(' ')}
            >
              {round.matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  data={data}
                  isSelected={selectedMatchId === match.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
)

const BracketsSection = () => {
  const [data, setData] = useState<BracketData | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<MatchView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadBracket = async () => {
      try {
        setIsLoading(true)
        setErrorMessage(null)

        const bracketData = await createBracketData()

        if (!isMounted) return

        setData(bracketData)

        const matchViews = buildMatchViews(bracketData)
        const firstCompletedMatch =
          matchViews.find(({ status }) => status === Status.Completed) ?? matchViews[0] ?? null

        setSelectedMatch(firstCompletedMatch)
      } catch (error) {
        if (!isMounted) return

        setErrorMessage(error instanceof Error ? error.message : 'Unable to render brackets.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadBracket()

    return () => {
      isMounted = false
    }
  }, [])

  const matchViews = data ? buildMatchViews(data) : []
  const upperRounds = groupMatchesByRound(matchViews, 1)
  const lowerRounds = groupMatchesByRound(matchViews, 2)
  const finalRounds = groupMatchesByRound(matchViews, 3)

  const matchTitle = selectedMatch?.matchLabel ?? 'Select a match'
  const matchSubtitle = selectedMatch
    ? `${selectedMatch.groupLabel} • ${selectedMatch.roundLabel}`
    : 'Click any match in the bracket to inspect the scoreline.'

  return (
    <section className="mt-14 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="relative overflow-hidden rounded-3xl border border-red/30 bg-[radial-gradient(circle_at_top_left,rgba(243,41,41,0.16),transparent_30%),linear-gradient(180deg,rgba(35,36,45,0.98),rgba(28,29,38,0.98))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)] md:p-6">
        {isLoading ? (
          <div className="flex min-h-[34rem] items-center justify-center text-center font-blockletter uppercase tracking-[0.22em] text-white">
            Loading bracket
          </div>
        ) : errorMessage ? (
          <div className="flex min-h-[34rem] items-center justify-center p-8 text-center text-white">
            {errorMessage}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 border-b border-white/10 px-2 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-blockletter text-sm uppercase tracking-[0.28em] text-red">
                  Custom bracket
                </p>
                <h2 className="mt-3 text-3xl text-white">
                  {data?.stages[0]?.name ?? 'AG Spring Championship'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-lightgray">
                <span className="rounded-full border border-white/10 bg-black/35 px-3 py-2">
                  {data?.participants.length ?? teams.length} teams
                </span>
                <span className="rounded-full border border-white/10 bg-black/35 px-3 py-2">
                  Double elimination
                </span>
                <span className="rounded-full border border-white/10 bg-black/35 px-3 py-2">
                  {matchViews.length} matches
                </span>
              </div>
            </div>

            <RoundColumns
              title="Upper bracket"
              rounds={upperRounds}
              data={data}
              selectedMatchId={selectedMatch?.id}
              onSelect={setSelectedMatch}
            />

            <RoundColumns
              title="Lower bracket"
              rounds={lowerRounds}
              data={data}
              selectedMatchId={selectedMatch?.id}
              onSelect={setSelectedMatch}
            />

            {finalRounds.length > 0 && (
              <RoundColumns
                title="Grand final"
                rounds={finalRounds}
                data={data}
                selectedMatchId={selectedMatch?.id}
                onSelect={setSelectedMatch}
              />
            )}
          </div>
        )}
      </div>

      <aside className="rounded-2xl border border-[rgba(243,41,41,0.35)] bg-darkgray/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <p className="font-blockletter text-sm uppercase tracking-[0.3em] text-red">Match focus</p>
        <h2 className="mt-4 text-3xl leading-tight">{matchTitle}</h2>
        <p className="mt-3 text-lightgray">{matchSubtitle}</p>

        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-4">
            <div className="flex items-center justify-between gap-4 text-lg">
              <span>{formatOpponentName(selectedMatch, 'opponent1', data)}</span>
              <span className="text-2xl text-red">
                {formatScore(selectedMatch?.opponent1?.score)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-4">
            <div className="flex items-center justify-between gap-4 text-lg">
              <span>{formatOpponentName(selectedMatch, 'opponent2', data)}</span>
              <span className="text-2xl text-red">
                {formatScore(selectedMatch?.opponent2?.score)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3 text-sm text-lightgray">
          <p>Bracket: {selectedMatch?.groupLabel ?? 'Double elimination'}</p>
          <p>Round: {selectedMatch?.roundLabel ?? 'Upcoming'}</p>
          <p>
            Format:{' '}
            {selectedMatch?.child_count ? `Bo${selectedMatch.child_count}` : 'Standard match'}
          </p>
          <p>Teams: {data?.participants.length ?? teams.length}</p>
          <p>Stage: {data?.stages[0]?.name ?? 'AG Spring Championship'}</p>
        </div>
      </aside>
    </section>
  )
}

export default BracketsSection
