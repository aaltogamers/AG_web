import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { AGEvent } from '../../types/types'
import type { StoredEvent } from '../../utils/eventStore'
import { eventMoment } from '../../utils/eventUtils'
import { fetchEvents } from '../../utils/eventsClient'
import EventEditor from './EventEditor'

const firstStart = (event: StoredEvent) => {
  const sessions = Array.isArray(event.data.sessions) ? (event.data.sessions as { start?: string }[]) : []
  return sessions.map((s) => s.start ?? '').sort()[0] ?? ''
}

// The "Events" admin tab: the list of events, and the editor of one
// (/admin/events?event=<slug>, or ?event=new)
const EventsSection = ({ events: siteEvents }: { events: AGEvent[] }) => {
  const router = useRouter()
  const openSlug = typeof router.query.event === 'string' ? router.query.event : null
  const [events, setEvents] = useState<StoredEvent[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setEvents((await fetchEvents()).events)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, openSlug])

  const open = (slug: string | null) => {
    const next = { ...router.query }
    if (slug) next.event = slug
    else delete next.event
    router.push({ pathname: router.pathname, query: next }, undefined, { shallow: true })
  }

  if (openSlug) {
    const event = openSlug === 'new' ? null : events?.find((e) => e.slug === openSlug)
    if (event === undefined) {
      return <div className="text-center">{events ? `No event "${openSlug}"` : error ?? 'Loading…'}</div>
    }
    return (
      <EventEditor
        key={`${openSlug}-${event?.version ?? 0}`}
        event={event}
        siteEvents={siteEvents}
        onSaved={(saved) => {
          setEvents((all) => [...(all ?? []).filter((e) => e.slug !== saved.slug), saved])
          if (saved.slug !== openSlug) open(saved.slug)
        }}
        onDeleted={() => open(null)}
        onClose={() => open(null)}
      />
    )
  }

  const q = query.toLowerCase()
  const shown = (events ?? [])
    .filter((e) => !q || String(e.data.name).toLowerCase().includes(q) || e.slug.includes(q))
    // Events without a time first, then the newest
    .sort((a, b) => (firstStart(a) && firstStart(b) ? firstStart(b).localeCompare(firstStart(a)) : firstStart(a) ? 1 : -1))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <button type="button" className="mainbutton" onClick={() => open('new')}>
          New event
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="p-2 rounded-md bg-white text-black border border-gray-300"
        />
      </div>
      {error && <div className="text-red">{error}</div>}
      {!events && !error && <div>Loading…</div>}
      <ul className="flex flex-col divide-y divide-lightgray/30">
        {shown.map((e) => {
          const start = firstStart(e)
          return (
            <li key={e.slug}>
              <button
                type="button"
                onClick={() => open(e.slug)}
                className="w-full flex flex-wrap gap-x-4 items-baseline py-2 text-left hover:text-red"
              >
                <span className="text-sm text-lightgray w-24">
                  {start ? eventMoment(start).format('D.M.YYYY') : 'No time yet'}
                </span>
                <span className="text-lg">{String(e.data.name)}</span>
                {(e.data.visibleOnEventsPage === false || e.data.visibleOnCalendar === false) && (
                  <span className="text-sm text-lightgray">(hidden)</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default EventsSection
