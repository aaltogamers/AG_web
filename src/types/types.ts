import type { Group, Id, Match, MatchGame, Participant, Round, Stage } from 'brackets-model'
import { BracketsManager } from 'brackets-manager'

export type AGEvent = {
  name: string
  image?: string
  time?: string
  durationHours: number
  otherTimes: { name?: string; time: string }[]
  location?: string
  visibleOnCalendar: boolean
  visibleOnEventsPage: boolean
  content: string
  description: string
  isRecurring?: boolean
  tldr: string
  slug: string
  albumID?: string
  recordings?: { name: string; url: string }[]
}

export type Option = {
  option: string
}

export type DataValue = string | number | boolean | string[]

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

export type EditableInputType = 'text' | 'select' | 'info'

export type EditableInputObj = {
  number: number
  type: EditableInputType
}

export type SignupInput = {
  id: number
  title: string
  description?: string
  type: EditableInputType
  number: number
  public: boolean
  required: boolean
  options?: string[]
  multi?: boolean
}
// Only use lowercase for keys
export type SignUpData = {
  name: string
  maxparticipants: number
  openfrom: string
  openuntil: string
  inputs: SignupInput[]
}

// A participant row as returned by /api/signups. `answers` is keyed by field id.
export type SignupRow = {
  id: string
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
  manager: BracketsManager
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

export const TOURNAMENT_BRACKET_TYPES: BracketType[] = ['double_elimination_to_top_4']

export const BRACKET_TYPE_LABELS: Record<BracketType, string> = {
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  double_elimination_to_top_4: 'Double Elimination with 4-team Final',
}

export const getBracketTypeLabel = (type: BracketType): string => BRACKET_TYPE_LABELS[type] ?? type

export const TOURNAMENT_TEAM_COUNTS = [16, 32] as const
export type TournamentTeamCount = (typeof TOURNAMENT_TEAM_COUNTS)[number]

export type TournamentSettings = {
  slug: string
  name: string
  bracketType: BracketType
  teamCount: TournamentTeamCount
  teams: string[]
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

export type TournamentSummary = TournamentSettings & {
  isStarted: boolean
}

export type Tournament = TournamentSettings & {
  data: BracketDatabaseSnapshot | null
  isStarted: boolean
}

export type StreamConfig = {
  id: string
  name: string
  // Query string portion (without leading "?"), e.g. "stream&stage=winners".
  query: string
}
