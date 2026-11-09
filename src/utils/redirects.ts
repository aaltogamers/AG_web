import { getFile } from './fileUtils'

export type Redirect = {
  name: string
  slug: string
  url: string
}

export const getRedirects = () =>
  (getFile('redirects', './public/') as unknown as { redirects?: Redirect[] }).redirects ?? []
