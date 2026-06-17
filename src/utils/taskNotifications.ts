export type UserSettings = {
  deadlineDays: number
  startDateDays: number
  notifyBeforeDeadline: boolean
  notifyBeforeStart: boolean
  notifyOnDeadline: boolean
  notifyOnStart: boolean
  notifyPastDeadline: boolean
  notifyPastStart: boolean
  skipInProgress: boolean
}

export const DEFAULT_SETTINGS: UserSettings = {
  deadlineDays: 5,
  startDateDays: 0,
  notifyBeforeDeadline: true,
  notifyBeforeStart: true,
  notifyOnDeadline: true,
  notifyOnStart: true,
  notifyPastDeadline: true,
  notifyPastStart: true,
  skipInProgress: false,
}

export type TaskNotificationRow = {
  task_id: string
  name: string
  description: string | null
  state: string
  deadline: Date | null
  start_time: Date | null
}

export type AssigneeRow = {
  task_id: string
  tg_user_name: string
  first_name: string | null
  last_name: string | null
}

export function toHelsinkiDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function buildAssigneeNamesMap(rows: AssigneeRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const a of rows) {
    const displayName = a.first_name
      ? `${a.first_name}${a.last_name ? ' ' + a.last_name : ''}`
      : a.tg_user_name
    if (!map.has(a.task_id)) map.set(a.task_id, [])
    map.get(a.task_id)!.push(displayName)
  }
  return map
}

const STATE_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

function formatDateShort(d: Date): string {
  const parts = toHelsinkiDate(d).split('-')
  return `${parts[2]}.${parts[1]}.`
}

export function formatTaskBlock(
  row: TaskNotificationRow,
  settings: UserSettings,
  assigneeNames: string[],
  today: Date,
): string | null {
  if (settings.skipInProgress && row.state === 'in_progress') return null

  const daysDiff = (d: Date): number => {
    const dateStr = new Date(toHelsinkiDate(d) + 'T00:00:00')
    return Math.round((dateStr.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  let deadlineShouldNotify = false
  let startShouldNotify = false
  const dlDiff = row.deadline ? daysDiff(row.deadline) : null
  const stDiff = row.start_time ? daysDiff(row.start_time) : null

  if (dlDiff !== null) {
    if (dlDiff < 0) deadlineShouldNotify = settings.notifyPastDeadline
    else if (dlDiff === 0) deadlineShouldNotify = settings.notifyOnDeadline
    else if (dlDiff <= settings.deadlineDays) deadlineShouldNotify = settings.notifyBeforeDeadline
  }

  if (stDiff !== null) {
    if (stDiff < 0) startShouldNotify = settings.notifyPastStart
    else if (stDiff === 0) startShouldNotify = settings.notifyOnStart
    else if (stDiff <= settings.startDateDays) startShouldNotify = settings.notifyBeforeStart
  }

  if (!deadlineShouldNotify && !startShouldNotify) return null

  const dateParts: string[] = []
  if (startShouldNotify && row.start_time) dateParts.push(`Start ${formatDateShort(row.start_time)}`)
  if (deadlineShouldNotify && row.deadline) dateParts.push(`DL. ${formatDateShort(row.deadline)}`)

  let icon = ''
  if ((dlDiff !== null && dlDiff < 0) || (stDiff !== null && stDiff < 0)) {
    icon = ' ❌'
  } else if ((dlDiff !== null && dlDiff === 0) || (stDiff !== null && stDiff === 0 && row.state === 'todo')) {
    icon = ' ⚠️'
  }

  const lines = [
    `<b>${row.name}</b>`,
    `${dateParts.join(' · ')} (${STATE_LABELS[row.state] || row.state})${icon}`,
    assigneeNames.join(', '),
  ]
  if (row.description) {
    lines.push('')
    lines.push(`<i>${row.description}</i>`)
  }

  return lines.join('\n')
}
