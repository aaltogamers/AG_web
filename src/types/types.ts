export type AGEvent = {
  name: string
  image: string
  time?: string
  content: string
  description: string
  isRecurring?: boolean
  tldr: string
  slug: string
  signupFields?: SignupField[]
}

export type SignupField = {
  name: string
  type: 'text' | 'select'
  required: boolean
  placeholder?: string
  options?: Option[]
}

export type Option = {
  option: string
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
  title: string
  status: string
  game: string
  image?: string
  orderNumber: number
}

export type AGAlbum = {
  name: string
  link: string
  image: string
}
export type LandingInfo = {
  title: string
  subtitle: string
  content: string
  image: string
  link: string
}

export type EditableInputType = 'text' | 'select' | 'info'

export type EditableInputObj = {
  number: number
  type: EditableInputType
}
