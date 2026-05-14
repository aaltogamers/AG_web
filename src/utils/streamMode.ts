import type { ParsedUrlQuery } from 'querystring'
import type { BracketStyles } from '../types/types'

export type StreamRoundLabel = 'Upper' | 'Lower'

export type StreamStageFilter = {
  // Indices into the `data: BracketData[]` array rendered by the view.
  // 0 = qualifier stage, 1 = finals stage. `undefined` = show all.
  stageIndices?: number[]
  // When set, only these group labels are rendered inside the qualifier stage.
  // The finals stage only has an Upper group so the filter is a no-op there.
  groups?: StreamRoundLabel[]
}

const COLOR_KEYS = new Set<keyof BracketStyles>([
  'textColor',
  'teamNameColor',
  'loseScoreColor',
  'winScoreColor',
  'roundColor',
  'connectorColor',
  'dividerColor',
])

const NUMBER_KEYS = new Set<keyof BracketStyles>([
  'titleFontSize',
  'basicFontSize',
  'teamHeight',
  'teamWidth',
  'teamGapX',
  'teamGapY',
  'bracketGap',
])

const getStringParam = (query: ParsedUrlQuery, key: string): string | undefined => {
  const raw = query[key]
  if (raw === undefined) return undefined
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined || value === null) return undefined
  return String(value)
}

/**
 * Stream mode is triggered by presence (any value, including empty) of
 * `?stream` or `?fullscreen` in the URL.
 */
export const isStreamMode = (query: ParsedUrlQuery): boolean =>
  query.stream !== undefined || query.fullscreen !== undefined

const normalizeColor = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('#')) return trimmed
  // Bare hex like `ff0000` or `fff` → prepend `#`.
  if (/^[0-9a-fA-F]{3,8}$/.test(trimmed)) return `#${trimmed}`
  return trimmed
}

/**
 * Builds a `BracketStyles` from a base, overriding any keys present in the
 * URL query. Color values without a leading `#` get one prepended. Numeric
 * values that don't parse are ignored.
 *
 */
export const parseStreamBracketStyles = (
  query: ParsedUrlQuery,
  base: BracketStyles
): BracketStyles => {
  const out: BracketStyles = { ...base }
  ;(Object.keys(base) as (keyof BracketStyles)[]).forEach((key) => {
    const raw = getStringParam(query, key)
    if (raw === undefined) return
    if (NUMBER_KEYS.has(key)) {
      const n = parseFloat(raw)
      if (!Number.isFinite(n)) return
      ;(out as Record<string, unknown>)[key] = n
    } else if (COLOR_KEYS.has(key)) {
      ;(out as Record<string, unknown>)[key] = normalizeColor(raw)
    }
  })
  return out
}

/**
 * Reads the `stage` query param and returns which stages/groups to display.
 *
 * Accepted values (case-insensitive):
 *   - `all` (or missing) — both stages, both groups.
 *   - `qualifier` — qualifier stage, Upper + Lower.
 *   - `winners` / `upper` — qualifier stage, Upper only.
 *   - `losers` / `lower` — qualifier stage, Lower only.
 *   - `finals` — finals stage only.
 */
export const parseStreamStageFilter = (query: ParsedUrlQuery): StreamStageFilter => {
  const raw = getStringParam(query, 'stage')?.toLowerCase().trim()
  if (!raw || raw === 'all') return {}
  switch (raw) {
    case 'qualifier':
      return { stageIndices: [0] }
    case 'winners':
    case 'upper':
      return { stageIndices: [0], groups: ['Upper'] }
    case 'losers':
    case 'lower':
      return { stageIndices: [0], groups: ['Lower'] }
    case 'finals':
      return { stageIndices: [1] }
    default:
      return {}
  }
}

export type StreamParamDoc = {
  name: string
  description: string
  type: 'flag' | 'enum' | 'number' | 'color'
  example: string
  defaultValue?: string
}

// Used to render the Stream Info page; keep in sync with the parsers above.
// The default values for style keys come from `defaultBracketStyles` in
// `TournamentBracketView.tsx` — passed in at render time so docs reflect the
// effective values.
export const buildStreamParamDocs = (defaults: BracketStyles): StreamParamDoc[] => [
  {
    name: 'stream',
    description:
      'Enables stream mode (hides nav bar, footer, page chrome, transparent background). Value is ignored.',
    type: 'flag',
    example: 'stream',
  },
  {
    name: 'fullscreen',
    description: 'Alias for `stream`.',
    type: 'flag',
    example: 'fullscreen',
  },
  {
    name: 'stage',
    description:
      'Which part of the bracket to show. One of: all, qualifier, winners (alias: upper), losers (alias: lower), finals.',
    type: 'enum',
    example: 'stage=winners',
    defaultValue: 'all',
  },
  ...(
    [
      ['titleFontSize', 'Title (round header) font size in px.'],
      ['basicFontSize', 'Base font size in px used for connectors and match numbers.'],
      ['teamHeight', 'Height of a single team row in px.'],
      ['teamWidth', 'Width of a single team box in px.'],
      ['teamGapX', 'Horizontal gap between rounds in px.'],
      ['teamGapY', 'Vertical gap between matches at round 1 in px.'],
      ['bracketGap', 'Gap between the qualifier and finals brackets in px.'],
    ] as const
  ).map(
    ([key, description]): StreamParamDoc => ({
      name: key,
      description,
      type: 'number',
      example: `${key}=${defaults[key]}`,
      defaultValue: String(defaults[key]),
    })
  ),
  ...(
    [
      ['textColor', 'Default text color'],
      ['teamNameColor', 'Background color of the team name box'],
      ['loseScoreColor', 'Score box background color for losing opponent'],
      ['winScoreColor', 'Score box background color for winning opponent'],
      ['roundColor', 'Background color of round-header bars'],
      ['connectorColor', 'Color of the lines connecting matches'],
      ['dividerColor', 'Color of the thin divider between the two opponents in a match'],
    ] as const
  ).map(([key, description]): StreamParamDoc => {
    const defaultValue = defaults[key]
    const stripped = typeof defaultValue === 'string' ? defaultValue.replace(/^#/, '') : ''
    return {
      name: key,
      description: `${description}.`,
      type: 'color',
      example: `${key}=${stripped}`,
      defaultValue: String(defaultValue),
    }
  }),
]
