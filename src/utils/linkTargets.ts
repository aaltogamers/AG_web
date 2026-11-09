// Links that can get a statistics tag and a QR code on the "Links and QR codes" admin page
import { getEvents } from './eventStore'
import { getRedirects } from './redirects'
import { SITE_URL } from './taggedLinks'

export type LinkTarget = { name: string; fileName: string; url: string }
export type LinkTargetGroup = { label: string; targets: LinkTarget[] }

const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Events', path: '/events' },
  { name: 'Join', path: '/join' },
  { name: 'About', path: '/about' },
  { name: 'Equipment', path: '/equipment' },
  { name: 'Partners', path: '/partners' },
  { name: 'Gallery', path: '/gallery' },
  { name: 'Tournaments', path: '/tournaments' },
]

export const redirectLinkTargets = (): LinkTarget[] =>
  getRedirects().map((r) => ({ name: r.name, fileName: r.slug, url: `${SITE_URL}/link/${r.slug}` }))

// Events that are upcoming or ended in the last week
export const getLinkTargetGroups = async (): Promise<LinkTargetGroup[]> => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const events = (await getEvents()).filter((e) => {
    const end = e.sessions.at(-1)?.end
    return end && new Date(end).getTime() > weekAgo
  })

  const groups: LinkTargetGroup[] = [
    { label: 'Redirect links', targets: redirectLinkTargets() },
    {
      label: 'Sign-ups',
      targets: events
        .filter((e) => e.signupMode !== 'none')
        .map((e) => ({
          name: `${e.name} sign-up`,
          fileName: `${e.slug}-signup`,
          url: `${SITE_URL}/events/${e.slug}#signups`,
        })),
    },
    {
      label: 'Events',
      targets: events.map((e) => ({
        name: e.name,
        fileName: e.slug,
        url: `${SITE_URL}/events/${e.slug}`,
      })),
    },
    {
      label: 'Pages',
      targets: PAGES.map((p) => ({
        name: p.name,
        fileName: p.path === '/' ? 'home' : p.path.slice(1),
        url: `${SITE_URL}${p.path}`,
      })),
    },
  ]
  return groups.filter((g) => g.targets.length > 0)
}
