import type { Group, Id, Match, MatchGame, Participant, Round, Stage } from 'brackets-model'
import { BracketsManager } from 'brackets-manager'

export type EventSession = {
  // Optional label, e.g. "Qualifiers" or "Finals"
  name?: string
  start: string
  end: string
  location: string
  // Random id given on save (eventStore.ts); sign-up forms are tied to it
  id?: string
}

// Sign-up forms themselves are created in the admin panel
export type SignupMode = 'none' | 'event' | 'session'

export type AGEvent = {
  name: string
  image: string
  // Sorted by start time
  sessions: EventSession[]
  signupMode: SignupMode
  visibleOnCalendar: boolean
  visibleOnEventsPage: boolean
  content: string
  description: string
  slug: string
  albumID?: string
  recordings?: { name: string; url: string }[]
}

export type Option = {
  option: string
}

// One entry of a group field, keyed by sub-field id
export type GroupItem = Record<string, string | string[]>

export type DataValue = string | number | boolean | string[] | GroupItem[]

export type Data = {
  [key: string]: DataValue
}

export type AGPartner = {
  name: string
  image: string
  description: string
  finnishLink: string
  englishLink: string
  content: string
}

export type AGBoardMember = {
  name: string
  title?: string
  status?: string
  game?: string
  image?: string
  contactInformation?: string
}

export type LycheeAlbumThumb = {
  id: string
  type: string
  thumb: string
  thumb2x: string
  placeholder: string
}

export type LycheeAlbum = {
  id: string
  title: string
  description: string | null
  thumb: LycheeAlbumThumb | null
  is_nsfw: boolean
  is_public: boolean
  has_subalbum: boolean
  num_subalbums: number
  num_photos: number
  created_at: string
  formatted_min_max: string | null
  owner: string | null
  timeline: {
    time_date: string
    format: string
  }
}

export type LandingInfo = {
  title: string
  subtitle: string
  content: string
  image: string
  isSmallImage?: boolean
}

export type HistoryEntry = {
  year: string
  title?: string
  boardMembers: AGBoardMember[]
  content?: string
  slug: string
}

// textarea is long text, image a picture upload (e.g. a team logo), and group a
// block of sub-fields filled in once per item (e.g. per player)
export type EditableInputType = 'text' | 'textarea' | 'select' | 'info' | 'image' | 'group'

export type SignupInput = {
  id: number
  title: string
  // Help text under the title (Markdown), or the text of an info box
  description?: string
  // Placeholder of text fields
  placeholder?: string
  type: EditableInputType
  number: number
  public: boolean
  required: boolean
  options?: string[]
  multi?: boolean
  // Group fields: sub-fields (ids are unique within the group), and how many items.
  // Items up to `min` are called "<itemLabel> 1…", the ones after "<extraLabel> 1…".
  fields?: SignupInput[]
  min?: number
  max?: number
  itemLabel?: string
  extraLabel?: string
}
export type SignupPool = {
  id: number
  name: string
  size: number
  // Private pools need a password to sign up to. The password is only sent to admins.
  private?: boolean
  password?: string
}

// Only use lowercase for keys
export type SignUpData = {
  key: string
  pools: SignupPool[]
  openfrom: string
  openuntil: string
  inputs: SignupInput[]
  // Shown to participants who got a place, not to those on a reserve list, e.g. a
  // link to the event's Telegram group. Only sent to admins and to those participants.
  confirmedMessage?: string
  confirmedLink?: string
}

// A participant row as returned by /api/signups. `answers` is keyed by field id.
export type SignupRow = {
  id: string
  pool_id: number
  created_at: string
  answers: Record<string, DataValue>
}

export type Poll = {
  id: string
  question: string
  options: string[]
  isVisible: boolean
  isVotable: boolean
  correctOption?: string
  pointsForWin?: number
  additionalMessage?: string
  creationTimeStamp: number
}

export type Vote = {
  id: string
  pickedOption: string
  poll: string
  user: string
  points?: number
}

export type ScoreBoardEntry = {
  name: string
  score: number
}

export const CS_ACTIVE_DUTY_MAPS = [
  'Ancient',
  'Dust II',
  'Inferno',
  'Mirage',
  'Nuke',
  'Overpass',
  'Train',
] as const

export const VALORANT_ACTIVE_DUTY_MAPS = [
  'Abyss',
  'Bind',
  'Haven',
  'Breeze',
  'Corrode',
  'Pearl',
  'Split',
] as const

export const GAMES = ['CS 2', 'Valorant'] as const
export type Game = (typeof GAMES)[number]

export type MapName = (typeof CS_ACTIVE_DUTY_MAPS | typeof VALORANT_ACTIVE_DUTY_MAPS)[number]

export type MapBanOrPick = {
  id: string
  type: 'ban' | 'pick' | 'decider'
  map: MapName
  team: string
  index: number
}

export type MapBanInfo = {
  team1: string
  team2: string
  game: string
}

export type HeaderLink = {
  name: string
  link: string
}

export type BracketData = {
  // Missing for display-only (Challengermode) tournaments
  manager?: BracketsManager
  stages: Stage[]
  groups: Group[]
  rounds: Round[]
  matches: Match[]
  matchGames: MatchGame[]
  participants: Participant[]
  prevMatches: Record<
    Id,
    {
      opponent1From?: OpponentFroMatch
      opponent2From?: OpponentFroMatch
    }
  >
  siblingMatches: Record<Id, Match>
  matchIds: {
    skip: Set<Id>
    qualifying: Set<Id>
    bronze: Set<Id>
    silver: Set<Id>
    gold: Set<Id>
  }
  streamMatchId: Id | null
  bestOfByRoundId?: Record<Id, number>
  placeholderParticipantIds?: Set<Id>
  roundNumberOffset?: number
  matchNumbers?: Record<Id, number>
  roundTitles?: Record<Id, string>
}

export type BracketStyles = {
  textColor: string
  teamNameColor: string
  loseScoreColor: string
  winScoreColor: string
  roundColor: string
  connectorColor: string
  dividerColor: string
  titleFontSize: number
  basicFontSize: number
  teamHeight: number
  teamWidth: number
  teamGapX: number
  teamGapY: number
  bracketGap: number
}

export type RoundLabel = 'Upper' | 'Lower' | 'Final' | 'Unknown'

export type OpponentFroMatch = { match: Match; outcome: 'winner' | 'loser' }

export type BracketType =
  | 'single_elimination'
  | 'double_elimination'
  | 'double_elimination_to_top_4'
  | 'swiss_to_single_elimination'
  | 'challengermode'

export const TOURNAMENT_BRACKET_TYPES: BracketType[] = [
  'double_elimination_to_top_4',
  'swiss_to_single_elimination',
]

export const BRACKET_TYPE_LABELS: Record<BracketType, string> = {
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  double_elimination_to_top_4: 'Double Elimination with 4-team Final',
  swiss_to_single_elimination: 'Swiss → Single Elimination',
  challengermode: 'Challengermode',
}

export const getBracketTypeLabel = (type: BracketType): string => BRACKET_TYPE_LABELS[type] ?? type

export const TOURNAMENT_TEAM_COUNTS = [16, 32] as const
export type TournamentTeamCount = (typeof TOURNAMENT_TEAM_COUNTS)[number]

export const SWISS_ROUND_OPTIONS = [3, 4, 5] as const
export const SWISS_ADVANCE_COUNT_OPTIONS = [4, 8, 16] as const
export const BEST_OF_OPTIONS = [1, 3, 5] as const

export type TournamentOptions = {
  swissRounds: (typeof SWISS_ROUND_OPTIONS)[number]
  advanceCount: (typeof SWISS_ADVANCE_COUNT_OPTIONS)[number]
  finalBestOf: (typeof BEST_OF_OPTIONS)[number]
}

export const DEFAULT_TOURNAMENT_OPTIONS: TournamentOptions = {
  swissRounds: 3,
  advanceCount: 16,
  finalBestOf: 3,
}

const pickOption = <T extends number>(allowed: readonly T[], value: unknown, fallback: T): T =>
  (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback

export const normalizeTournamentOptions = (raw: unknown): TournamentOptions => {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    swissRounds: pickOption(
      SWISS_ROUND_OPTIONS,
      o.swissRounds,
      DEFAULT_TOURNAMENT_OPTIONS.swissRounds
    ),
    advanceCount: pickOption(
      SWISS_ADVANCE_COUNT_OPTIONS,
      o.advanceCount,
      DEFAULT_TOURNAMENT_OPTIONS.advanceCount
    ),
    finalBestOf: pickOption(BEST_OF_OPTIONS, o.finalBestOf, DEFAULT_TOURNAMENT_OPTIONS.finalBestOf),
  }
}

export type TournamentSource = 'local' | 'challengermode'

export type TournamentSettings = {
  slug: string
  name: string
  source: TournamentSource
  challengermodeId: string | null
  bracketType: BracketType
  teamCount: TournamentTeamCount
  teams: string[]
  options: TournamentOptions
}

// Exported snapshot of the BracketsManager database. We mirror the library's
// `Database` shape here to avoid leaking the brackets-manager type to every
// caller; it's intentionally `unknown` for safety at the storage boundary.
export type BracketDatabaseSnapshot = {
  stage: unknown[]
  group: unknown[]
  round: unknown[]
  match: unknown[]
  match_game: unknown[]
  participant: unknown[]
}

const CHALLENGERMODE_FORMAT_LABELS: Record<ChallengermodeStageFormat, string> = {
  SINGLE_ELIMINATION: 'Single Elimination',
  DOUBLE_ELIMINATION: 'Double Elimination',
  SWISS: 'Swiss',
  ROUND_ROBIN: 'Round Robin',
  OTHER: 'Custom',
  UNKNOWN: 'Unknown',
}

export const getFormatDescription = (
  t: TournamentSettings & { challengermode?: ChallengermodeTournament | null }
): string => {
  if (t.source === 'challengermode') {
    const stages = t.challengermode?.stages ?? []
    if (stages.length === 0) return 'Challengermode'
    const formats = stages.map((s) => CHALLENGERMODE_FORMAT_LABELS[s.format] ?? s.format)
    return `Challengermode — ${formats.join(' → ')} — ${stages[0].lineupCount} teams`
  }
  return t.bracketType === 'swiss_to_single_elimination'
    ? `${getBracketTypeLabel(t.bracketType)} — up to ${t.teamCount} teams — ${t.options.swissRounds} Swiss rounds, top ${t.options.advanceCount} advance, final Bo${t.options.finalBestOf}`
    : `${getBracketTypeLabel(t.bracketType)} — ${t.teamCount} teams`
}

export type TournamentSummary = TournamentSettings & {
  isStarted: boolean
}

export type Tournament = TournamentSettings & {
  data: BracketDatabaseSnapshot | null
  isStarted: boolean
  /** ISO timestamp from DB `updated_at`; used for live refresh / change detection. */
  updatedAt: string
  /** Match ID from bracket snapshot designated for stream overlay; null if unset. */
  streamMatchId: number | null
  // Only for Challengermode tournaments; null when it couldn't be fetched
  challengermode: ChallengermodeTournament | null
}

export type ChallengermodeStageFormat =
  | 'SINGLE_ELIMINATION'
  | 'DOUBLE_ELIMINATION'
  | 'SWISS'
  | 'ROUND_ROBIN'
  | 'OTHER'
  | 'UNKNOWN'

export type ChallengermodeSeriesState =
  | 'UNKNOWN'
  | 'WAITING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'NULLIFIED'

export type ChallengermodeSlot = {
  lineupId: string
  name: string
  seed: number | null
  score: number | null
  result: 'win' | 'loss' | 'draw' | null
}

export type ChallengermodeSeries = {
  ordinal: number
  state: ChallengermodeSeriesState
  bestOf: number
  labels: string[]
  // null = no team (yet)
  slots: [ChallengermodeSlot | null, ChallengermodeSlot | null]
}

export type ChallengermodeRound = { title: string; series: ChallengermodeSeries[] }

export type ChallengermodeBracketKind = 'single' | 'upper' | 'lower' | 'final' | 'swiss'

export type ChallengermodeBracket = {
  kind: ChallengermodeBracketKind
  rounds: ChallengermodeRound[]
}

export type ChallengermodeStage = {
  format: ChallengermodeStageFormat
  lineupCount: number
  roundCount: number
  brackets: ChallengermodeBracket[]
}

export type ChallengermodeTournament = {
  id: string
  name: string
  state: string
  stages: ChallengermodeStage[]
}

export const challengermodeTournamentUrl = (id: string) =>
  `https://www.challengermode.com/tournaments/${id}`

export const hasBracket = (t: Pick<Tournament, 'source' | 'data' | 'challengermode'>): boolean =>
  t.source === 'challengermode' ? (t.challengermode?.stages.length ?? 0) > 0 : !!t.data

export type StreamConfig = {
  id: string
  name: string
  // Query string portion (without leading "?"), e.g. "stream&stage=winners".
  query: string
}

export const TASK_STATES = ['someday', 'todo', 'in_progress', 'done'] as const
export type TaskState = (typeof TASK_STATES)[number]

export const TASK_STATE_LABELS: Record<TaskState, string> = {
  someday: 'Someday',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

export type TaskAssignee = {
  tgUserId: string
  tgUserName: string
  firstName?: string
  lastName?: string
}

export type Task = {
  id: string
  name: string
  description?: string
  deadline?: string
  startTime?: string
  state: TaskState
  assignees: TaskAssignee[]
  createdByTgId?: string
  createdByTgName?: string
  position: number
  createdAt: string
  updatedAt: string
  doneAt?: string
  aiContext?: string
  aiContextConfidence?: string
}

export type TgUser = {
  id: string
  tgUserId: string
  firstName: string
  lastName?: string
  username?: string
}

export type TaskNotificationSettings = {
  tgUserId: string
  deadlineDays: number
  startDateDays: number
  notifyCreation: boolean
  notifyBeforeDeadline: boolean
  notifyBeforeStart: boolean
  notifyOnDeadline: boolean
  notifyOnStart: boolean
  notifyPastDeadline: boolean
  notifyPastStart: boolean
  skipInProgress: boolean
}
