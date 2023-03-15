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

export type AGPartner = {
  name: string
  image: string
  description: string
  finnishLink: string
  englishLink: string
  content: string
}
