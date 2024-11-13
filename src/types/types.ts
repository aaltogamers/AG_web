import { Timestamp } from 'firebase/firestore'

export type AGEvent = {
  name: string
  image: string
  time?: string
  content: string
  description: string
  isRecurring?: boolean
  tldr: string
  slug: string
}

export type Option = {
  option: string
}

export type DataValue = string | number | boolean | Timestamp

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
  orderNumber: number
}

export type AGAlbum = {
  name: string
  link: string
  image: string
  orderNumber: number
}
export type LandingInfo = {
  title: string
  subtitle: string
  content: string
  image: string
  isSmallImage?: boolean
}

export type EditableInputType = 'text' | 'select' | 'info'

export type EditableInputObj = {
  number: number
  type: EditableInputType
}

export type SignupInput = {
  title: string
  description?: string
  type: EditableInputType
  number: number
  public: boolean
  required: boolean
  options?: string[]
  multi?: boolean
}

export type SignUpData = {
  name: string
  maxParticipants: number
  openFrom: string
  openUntil: string
  inputs: SignupInput[]
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
  'Anubis',
  'Dust II',
  'Inferno',
  'Mirage',
  'Nuke',
  'Vertigo',
] as const

export type MapName = (typeof CS_ACTIVE_DUTY_MAPS)[number]

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
}
