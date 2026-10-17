import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import type { AGEvent } from '../../types/types'
import type { StoredEvent } from '../../utils/eventStore'
import { eventMoment, getSignupTargets, normalizeEvent } from '../../utils/eventUtils'
import { fetchEvents } from '../../utils/eventsClient'
import EventThumbnail from '../EventThumbnail'
import PostEditor from '../posts/PostEditor'
import SignupEditor from '../SignupEditor'
import EventEditor from './EventEditor'

const firstStart = (event: StoredEvent) => {
  const sessions = Array.isArray(event.data.sessions) ? (event.data.sessions as { start?: string }[]) : []
  return sessions.map((s) => s.start ?? '').sort()[0] ?? ''
}

const toAGEvent = (event: StoredEvent) => normalizeEvent({ ...event.data, content: event.body, slug: event.slug })

const queryParam = (value: string | string[] | undefined) => (typeof value === 'string' ? value : null)

// The "Events" admin tab: the list of events, the editor of one (/admin/events?event=<slug>,
// or ?event=new), and the editors of its sign-up forms (&signup=<sign-up key>) and posts
// (&post=<id>, or &post=new). With &from=calendar, going back goes to the calendar.
const EventsSection = ({ events: siteEvents }: { events: AGEvent[] }) => {
  const router = useRouter()
  const openSlug = queryParam(router.query.event)
  const signupKey = queryParam(router.query.signup)
  const postId = queryParam(router.query.post)
  const isFromCalendar = router.query.from === 'calendar'
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

  // The saved events, so that sign-ups of sessions added since the page was loaded can be edited
  const agEvents = useMemo(() => (events ?? []).map(toAGEvent), [events])

  const go = (slug: string | null, sub?: { signup?: string; post?: string }) => {
    const next = { ...router.query }
    delete next.event
    delete next.signup
    delete next.post
    delete next.from
    if (slug) next.event = slug
    if (slug && sub?.signup) next.signup = sub.signup
    if (slug && sub?.post) next.post = sub.post
    router.push({ pathname: router.pathname, query: next }, undefined, { shallow: true })
  }

  if (openSlug) {
    const event = openSlug === 'new' ? null : events?.find((e) => e.slug === openSlug)
    if (event === undefined) {
      return <div className="text-center">{events ? `No event "${openSlug}"` : error ?? 'Loading…'}</div>
    }

    if (event && signupKey) {
      const target = getSignupTargets(toAGEvent(event)).find((t) => t.key === signupKey)
      if (!target) return <div className="text-center">No sign-up &quot;{signupKey}&quot;</div>
      return (
        <SignupEditor
          key={signupKey}
          target={target}
          allTargets={agEvents.flatMap(getSignupTargets)}
          backLabel={isFromCalendar ? 'Calendar' : event.data.name ? String(event.data.name) : undefined}
          onClose={() => (isFromCalendar ? router.push('/admin/posts') : go(event.slug))}
        />
      )
    }

    if (event && postId) {
      return (
        <PostEditor
          key={postId}
          postId={postId === 'new' ? null : postId}
          initialEventSlug={event.slug}
          events={agEvents}
          backLabel={String(event.data.name)}
          onSaved={(id) => go(event.slug, { post: id })}
          onClose={() => go(event.slug)}
        />
      )
    }

    return (
      <EventEditor
        key={`${openSlug}-${event?.version ?? 0}`}
        event={event}
        siteEvents={siteEvents}
        onSaved={(saved) => {
          setEvents((all) => [...(all ?? []).filter((e) => e.slug !== saved.slug), saved])
          if (saved.slug !== openSlug) go(saved.slug)
        }}
        onDeleted={() => go(null)}
        backLabel={isFromCalendar ? 'Calendar' : 'All events'}
        onClose={() => (isFromCalendar ? router.push('/admin/posts') : go(null))}
        onOpenSignup={(key) => event && go(event.slug, { signup: key })}
        onOpenPost={(id) => event && go(event.slug, { post: id })}
      />
    )
  }

  const q = query.toLowerCase()
  const shown = (events ?? [])
    .filter((e) => !q || String(e.data.name).toLowerCase().includes(q) || e.slug.includes(q))
    // Events without a time first, then the newest (or furthest in the future)
    .sort((a, b) => (firstStart(a) && firstStart(b) ? firstStart(b).localeCompare(firstStart(a)) : firstStart(a) ? 1 : -1))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <button type="button" className="mainbutton" onClick={() => go('new')}>
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
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {shown.map((e) => {
          const start = firstStart(e)
          const isHidden = e.data.visibleOnEventsPage === false || e.data.visibleOnCalendar === false
          return (
            <li key={e.slug}>
              <button
                type="button"
                onClick={() => go(e.slug)}
                className="w-full flex flex-col gap-1 text-left rounded-md p-1 border-2 border-transparent hover:border-red"
              >
                <EventThumbnail image={typeof e.data.image === 'string' ? e.data.image : ''} />
                <span className="leading-tight line-clamp-2">{String(e.data.name)}</span>
                <span className="text-sm text-lightgray">
                  {start ? eventMoment(start).format('D.M.YYYY') : 'No time yet'}
                  {isHidden && ' · hidden'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default EventsSection
