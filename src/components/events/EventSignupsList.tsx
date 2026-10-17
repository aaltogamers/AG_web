import { useEffect, useMemo, useState } from 'react'
import moment from 'moment'
import type { SignupMode } from '../../types/types'
import type { StoredEvent } from '../../utils/eventStore'
import { eventMoment, getSignupStatus, getSignupTargets, normalizeEvent, type SignupTarget } from '../../utils/eventUtils'
import { getSignupSummaries, type SignupSummary } from '../../utils/signupApi'

type Props = {
  event: StoredEvent
  // Adding is disabled while the event has unsaved changes, since it may save the event
  disabled: boolean
  onOpen: (key: string) => void
  // Adds the sign-up form `key`, changing the event's sign-up mode to `mode` if needed
  onAdd: (mode: SignupMode, key: string) => void
}

const targetLabel = ({ session }: SignupTarget) =>
  session ? session.name || eventMoment(session.start).format('ddd D.M.YYYY HH:mm') : 'The whole event'

const statusText = (summary: SignupSummary) => {
  const status = getSignupStatus(summary)
  const format = (time: string) => moment(time).format('D.M. HH:mm')
  if (status === 'notOpen') return `Opens ${format(summary.openfrom)}`
  if (status === 'open') return `Open until ${format(summary.openuntil)}`
  return `Closed ${format(summary.openuntil)}`
}

// The sign-up forms of an event, and a menu for adding one for the whole event or a session
const EventSignupsList = ({ event, disabled, onOpen, onAdd }: Props) => {
  const agEvent = useMemo(
    () => normalizeEvent({ ...event.data, content: event.body, slug: event.slug }),
    [event]
  )
  const mode = agEvent.signupMode
  // Both kinds, so the menu knows what can be added
  const wholeEvent = getSignupTargets({ ...agEvent, signupMode: 'event' })[0]
  const sessionTargets = getSignupTargets({ ...agEvent, signupMode: 'session' }).filter((t) => t.session?.id)
  const current = mode === 'event' ? [wholeEvent] : mode === 'session' ? sessionTargets : []
  const [summaries, setSummaries] = useState<Record<string, SignupSummary> | null>(null)

  const currentKeys = current.map((t) => t.key).join(',')
  useEffect(() => {
    let cancelled = false
    getSignupSummaries(currentKeys ? currentKeys.split(',') : []).then(
      (list) => !cancelled && setSummaries(Object.fromEntries(list.map((s) => [s.key, s])))
    )
    return () => {
      cancelled = true
    }
  }, [currentKeys])

  if (!summaries) return <span className="text-sm text-lightgray">Loading…</span>

  const existing = current.filter((t) => summaries[t.key])
  // One kind of sign-up at a time: a form for the whole event, or forms for sessions
  const addable: { mode: SignupMode; target: SignupTarget }[] = !existing.length
    ? [
        { mode: 'event', target: wholeEvent },
        ...sessionTargets.map((target) => ({ mode: 'session' as const, target })),
      ]
    : mode === 'session'
      ? sessionTargets.filter((t) => !summaries[t.key]).map((target) => ({ mode: 'session' as const, target }))
      : []

  return (
    <div className="flex flex-col gap-2">
      {existing.length > 0 && (
        <ul className="flex flex-col gap-2">
          {existing.map((target) => {
            const summary = summaries[target.key]
            const count = Object.values(summary.counts).reduce((sum, n) => sum + n, 0)
            return (
              <li key={target.key}>
                <button
                  type="button"
                  onClick={() => onOpen(target.key)}
                  className="w-full text-left border border-lightgray/40 hover:border-red rounded-md p-3 bg-white flex flex-wrap gap-x-4 gap-y-1 items-baseline"
                >
                  <span className="font-bold flex-1">{targetLabel(target)}</span>
                  <span className="text-sm">{statusText(summary)}</span>
                  <span className="text-sm text-lightgray">
                    {count} signed up
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {!existing.length && <span className="text-sm text-lightgray">No sign-up forms.</span>}
      {addable.length > 0 && (
        <select
          value=""
          disabled={disabled}
          onChange={(e) => {
            const option = addable.find((o) => o.target.key === e.target.value)
            if (option) onAdd(option.mode, option.target.key)
          }}
          className="p-2 rounded-md bg-white text-black border border-gray-300 self-start"
        >
          <option value="">+ Add sign-up…</option>
          {addable.map(({ target }) => (
            <option key={target.key} value={target.key}>
              {target.session ? `For ${targetLabel(target)}` : 'For the whole event'}
            </option>
          ))}
        </select>
      )}
      <span className="text-sm text-lightgray">
        {disabled
          ? 'Save the event before adding a sign-up.'
          : mode === 'event' && existing.length
            ? 'There is one sign-up for the whole event. To have one per session instead, delete it first.'
            : !existing.length && agEvent.sessions.length > 0
              ? 'One sign-up for the whole event, or one per session.'
              : null}
      </span>
    </div>
  )
}

export default EventSignupsList
