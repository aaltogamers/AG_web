export const ADMIN_SECTIONS = ['signups', 'bets', 'mapbans', 'stats'] as const
export type AdminSection = (typeof ADMIN_SECTIONS)[number]

export function isAdminSection(s: string | undefined): s is AdminSection {
  return s !== undefined && (ADMIN_SECTIONS as readonly string[]).includes(s)
}
