import { useEffect, useState, type CSSProperties } from 'react'
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

type RoundView = {
  roundNumber: number
  roundLabel: string
  matches: MatchView[]
}

type BracketStyleVars = CSSProperties & Record<`--${string}`, string>

const BRACKET_STYLE = {
  colors: {
    accent: '#F32929',
    accentSoft: 'rgba(243, 41, 41, 0.16)',
    accentSubtle: 'rgba(243, 41, 41, 0.1)',
    panelTop: 'rgba(35, 36, 45, 0.98)',
    panelBottom: 'rgba(28, 29, 38, 0.98)',
    cardTop: 'rgba(35, 36, 45, 0.96)',
    cardBottom: 'rgba(28, 29, 38, 0.96)',
    borderMuted: 'rgba(255, 255, 255, 0.1)',
    borderStrong: 'rgba(243, 41, 41, 0.35)',
    chipBackground: 'rgba(0, 0, 0, 0.35)',
    textPrimary: '#FFFFFF',
    textMuted: '#AAABAD',
  },
  spacing: {
    shellPadding: '1rem',
    shellPaddingDesktop: '1.5rem',
    sectionPadding: '1.25rem',
    cardPadding: '1rem',
    roundHeaderY: '0.75rem',
    roundHeaderX: '1rem',
    chipPaddingY: '0.5rem',
    chipPaddingX: '0.75rem',
    detailCardPadding: '1rem',
    panelGap: '1.5rem',
  },
  sizing: {
    bracketMinHeight: '34rem',
    detailsPanelWidth: '22rem',
    cardWidth: '18rem',
    panelRadius: '1.5rem',
    cardRadius: '1rem',
  },
  effects: {
    shellShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
    cardShadow: '0 12px 30px rgba(0, 0, 0, 0.22)',
    selectedCardShadow: '0 16px 36px rgba(243, 41, 41, 0.18)',
  },
  rounds: {
    minGapPx: 12,
    stepGapPx: 20,
    maxGapPx: 170,
  },
}

const bracketVars: BracketStyleVars = {
  '--br-accent': BRACKET_STYLE.colors.accent,
  '--br-accent-soft': BRACKET_STYLE.colors.accentSoft,
  '--br-accent-subtle': BRACKET_STYLE.colors.accentSubtle,
  '--br-panel-top': BRACKET_STYLE.colors.panelTop,
  '--br-panel-bottom': BRACKET_STYLE.colors.panelBottom,
  '--br-card-top': BRACKET_STYLE.colors.cardTop,
  '--br-card-bottom': BRACKET_STYLE.colors.cardBottom,
  '--br-border-muted': BRACKET_STYLE.colors.borderMuted,
  '--br-border-strong': BRACKET_STYLE.colors.borderStrong,
  '--br-chip-bg': BRACKET_STYLE.colors.chipBackground,
  '--br-text-primary': BRACKET_STYLE.colors.textPrimary,
  '--br-text-muted': BRACKET_STYLE.colors.textMuted,
  '--br-shell-pad': BRACKET_STYLE.spacing.shellPadding,
  '--br-shell-pad-desktop': BRACKET_STYLE.spacing.shellPaddingDesktop,
  '--br-section-pad': BRACKET_STYLE.spacing.sectionPadding,
  '--br-card-pad': BRACKET_STYLE.spacing.cardPadding,
  '--br-round-header-y': BRACKET_STYLE.spacing.roundHeaderY,
  '--br-round-header-x': BRACKET_STYLE.spacing.roundHeaderX,
  '--br-chip-pad-y': BRACKET_STYLE.spacing.chipPaddingY,
  '--br-chip-pad-x': BRACKET_STYLE.spacing.chipPaddingX,
  '--br-detail-card-pad': BRACKET_STYLE.spacing.detailCardPadding,
  '--br-panel-gap': BRACKET_STYLE.spacing.panelGap,
  '--br-shell-min-height': BRACKET_STYLE.sizing.bracketMinHeight,
  '--br-details-width': BRACKET_STYLE.sizing.detailsPanelWidth,
  '--br-card-width': BRACKET_STYLE.sizing.cardWidth,
  '--br-panel-radius': BRACKET_STYLE.sizing.panelRadius,
  '--br-card-radius': BRACKET_STYLE.sizing.cardRadius,
  '--br-shell-shadow': BRACKET_STYLE.effects.shellShadow,
  '--br-card-shadow': BRACKET_STYLE.effects.cardShadow,
  '--br-card-selected-shadow': BRACKET_STYLE.effects.selectedCardShadow,
}

const statusLabels: Record<Status, string> = {
  [Status.Locked]: 'Locked',
  [Status.Waiting]: 'Waiting',
  [Status.Ready]: 'Ready',
  [Status.Running]: 'Live',
  [Status.Completed]: 'Final',
  [Status.Archived]: 'Archived',
}

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

const getRoundGapPx = (matchesInRound: number, maxMatchesInGroup: number) => {
  const delta = Math.max(0, maxMatchesInGroup - matchesInRound)
  const computedGap = BRACKET_STYLE.rounds.minGapPx + delta * BRACKET_STYLE.rounds.stepGapPx

  return Math.min(BRACKET_STYLE.rounds.maxGapPx, computedGap)
}

const getStatusTone = (status: Status) => {
  if (status === Status.Completed)
    return 'border-[var(--br-accent)]/40 bg-[var(--br-accent)]/10 text-[var(--br-accent)]'
  if (status === Status.Running)
    return 'border-[var(--br-accent)]/40 bg-[var(--br-accent)]/15 text-[var(--br-text-primary)]'
  if (status === Status.Ready)
    return 'border-[var(--br-border-muted)] bg-white/5 text-[var(--br-text-primary)]'
  return 'border-[var(--br-border-muted)] bg-black/40 text-[var(--br-text-muted)]'
}

const getParticipantTone = (result?: string) => {
  if (result === 'win') return 'bg-[var(--br-accent)]/10 text-[var(--br-text-primary)]'
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

const groupMatchesByRound = (matches: MatchView[], groupNumber: number): RoundView[] => {
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
      'w-[var(--br-card-width)] rounded-[var(--br-card-radius)] border p-[var(--br-card-pad)] text-left transition duration-150 ease-in-out',
      'bg-[linear-gradient(180deg,var(--br-card-top),var(--br-card-bottom))] shadow-[var(--br-card-shadow)]',
      isSelected
        ? 'border-[var(--br-accent)] shadow-[var(--br-card-selected-shadow)]'
        : 'border-[var(--br-border-muted)] hover:border-[var(--br-accent)] hover:-translate-y-0.5',
    ].join(' ')}
  >
    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-[var(--br-text-muted)]">
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
          'flex items-center justify-between gap-3 rounded-xl border border-[var(--br-border-muted)] px-3 py-3',
          getParticipantTone(match.opponent1?.result),
        ].join(' ')}
      >
        <span className="truncate pr-3 text-base">
          {formatOpponentName(match, 'opponent1', data)}
        </span>
        <span className="text-xl font-semibold text-[var(--br-accent)]">
          {formatScore(match.opponent1?.score)}
        </span>
      </div>
      <div
        className={[
          'flex items-center justify-between gap-3 rounded-xl border border-[var(--br-border-muted)] px-3 py-3',
          getParticipantTone(match.opponent2?.result),
        ].join(' ')}
      >
        <span className="truncate pr-3 text-base">
          {formatOpponentName(match, 'opponent2', data)}
        </span>
        <span className="text-xl font-semibold text-[var(--br-accent)]">
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
  rounds: RoundView[]
  data: BracketData | null
  selectedMatchId?: Id
  onSelect: (match: MatchView) => void
}) => {
  const maxMatchesInGroup = Math.max(1, ...rounds.map((round) => round.matches.length))

  return (
    <section className="rounded-[var(--br-panel-radius)] border border-[var(--br-border-muted)] bg-darkgray/70 p-[var(--br-section-pad)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--br-border-muted)] pb-4">
        <h3 className="font-blockletter text-xl uppercase tracking-[0.16em] text-[var(--br-text-primary)]">
          {title}
        </h3>
        <span className="text-xs uppercase tracking-[0.22em] text-[var(--br-text-muted)]">
          {rounds.length} rounds
        </span>
      </div>
      <div className="mt-6 overflow-x-auto pb-2">
        {rounds.length === 0 ? (
          <div className="rounded-[var(--br-card-radius)] border border-dashed border-[var(--br-border-muted)] p-8 text-center text-[var(--br-text-muted)]">
            No matches in this section yet.
          </div>
        ) : (
          <div className="flex min-w-max items-start gap-6 pr-2">
            {rounds.map((round) => (
              <div
                key={`${title}-${round.roundNumber}`}
                className="w-[var(--br-card-width)] shrink-0"
              >
                <div
                  className="mb-4 rounded-[var(--br-card-radius)] border border-[var(--br-border-strong)] bg-[var(--br-accent-subtle)] text-center"
                  style={{
                    padding: `var(--br-round-header-y) var(--br-round-header-x)`,
                  }}
                >
                  <p className="font-blockletter text-sm uppercase tracking-[0.22em] text-[var(--br-accent)]">
                    {round.roundLabel}
                  </p>
                </div>
                <div
                  className="flex flex-col"
                  style={{
                    rowGap: `${getRoundGapPx(round.matches.length, maxMatchesInGroup)}px`,
                  }}
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
        )}
      </div>
    </section>
  )
}

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
    ? `${selectedMatch.groupLabel} � ${selectedMatch.roundLabel}`
    : 'Click any match in the bracket to inspect the scoreline.'

  return (
    <section
      className="mt-14 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_var(--br-details-width)] xl:items-start"
      style={bracketVars}
    >
      <div className="relative overflow-hidden rounded-[var(--br-panel-radius)] border border-[var(--br-border-strong)] bg-[radial-gradient(circle_at_top_left,var(--br-accent-soft),transparent_30%),linear-gradient(180deg,var(--br-panel-top),var(--br-panel-bottom))] p-[var(--br-shell-pad)] shadow-[var(--br-shell-shadow)] md:p-[var(--br-shell-pad-desktop)]">
        {isLoading ? (
          <div className="flex min-h-[var(--br-shell-min-height)] items-center justify-center text-center font-blockletter uppercase tracking-[0.22em] text-[var(--br-text-primary)]">
            Loading bracket
          </div>
        ) : errorMessage ? (
          <div className="flex min-h-[var(--br-shell-min-height)] items-center justify-center p-8 text-center text-[var(--br-text-primary)]">
            {errorMessage}
          </div>
        ) : (
          <div className="space-y-[var(--br-panel-gap)]">
            <div className="flex flex-col gap-3 border-b border-[var(--br-border-muted)] px-2 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-blockletter text-sm uppercase tracking-[0.28em] text-[var(--br-accent)]">
                  Custom bracket
                </p>
                <h2 className="mt-3 text-3xl text-[var(--br-text-primary)]">
                  {data?.stages[0]?.name ?? 'AG Spring Championship'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-[var(--br-text-muted)]">
                <span
                  className="rounded-full border border-[var(--br-border-muted)] bg-[var(--br-chip-bg)]"
                  style={{ padding: `var(--br-chip-pad-y) var(--br-chip-pad-x)` }}
                >
                  {data?.participants.length ?? teams.length} teams
                </span>
                <span
                  className="rounded-full border border-[var(--br-border-muted)] bg-[var(--br-chip-bg)]"
                  style={{ padding: `var(--br-chip-pad-y) var(--br-chip-pad-x)` }}
                >
                  Double elimination
                </span>
                <span
                  className="rounded-full border border-[var(--br-border-muted)] bg-[var(--br-chip-bg)]"
                  style={{ padding: `var(--br-chip-pad-y) var(--br-chip-pad-x)` }}
                >
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

      <aside className="rounded-[var(--br-panel-radius)] border border-[var(--br-border-strong)] bg-darkgray/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <p className="font-blockletter text-sm uppercase tracking-[0.3em] text-[var(--br-accent)]">
          Match focus
        </p>
        <h2 className="mt-4 text-3xl leading-tight text-[var(--br-text-primary)]">{matchTitle}</h2>
        <p className="mt-3 text-[var(--br-text-muted)]">{matchSubtitle}</p>

        <div className="mt-8 space-y-[var(--br-panel-gap)]">
          <div
            className="rounded-xl border border-[var(--br-border-muted)] bg-black/50"
            style={{ padding: 'var(--br-detail-card-pad)' }}
          >
            <div className="flex items-center justify-between gap-4 text-lg">
              <span>{formatOpponentName(selectedMatch, 'opponent1', data)}</span>
              <span className="text-2xl text-[var(--br-accent)]">
                {formatScore(selectedMatch?.opponent1?.score)}
              </span>
            </div>
          </div>

          <div
            className="rounded-xl border border-[var(--br-border-muted)] bg-black/50"
            style={{ padding: 'var(--br-detail-card-pad)' }}
          >
            <div className="flex items-center justify-between gap-4 text-lg">
              <span>{formatOpponentName(selectedMatch, 'opponent2', data)}</span>
              <span className="text-2xl text-[var(--br-accent)]">
                {formatScore(selectedMatch?.opponent2?.score)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3 text-sm text-[var(--br-text-muted)]">
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
