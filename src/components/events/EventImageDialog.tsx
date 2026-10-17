import { useState } from 'react'
import type { AGEvent } from '../../types/types'
import { DEFAULT_EVENT_IMAGE } from '../../utils/eventUtils'
import Dialog from '../Dialog'

// Picks another event's image, e.g. for the next one of a recurring event
const EventImageDialog = ({
  events,
  onPick,
  onClose,
}: {
  events: AGEvent[]
  onPick: (path: string) => void
  onClose: () => void
}) => {
  const [query, setQuery] = useState('')
  const q = query.toLowerCase()
  const options = events
    .filter((e) => e.image && e.image !== DEFAULT_EVENT_IMAGE)
    .map((e) => ({ path: e.image, label: e.name }))
    .filter((e, i, all) => all.findIndex((o) => o.path === e.path) === i)
    .filter((o) => !q || o.label.toLowerCase().includes(q))

  return (
    <Dialog onClose={onClose} title="Pick an event's image" maxWidthClass="max-w-4xl" fullScreenOnMobile>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by event name"
        className="p-2 rounded-md bg-white text-black"
      />
      {!options.length && <div className="text-lightgray">No event images.</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {options.slice(0, 120).map((o) => (
          <button
            key={o.path}
            type="button"
            onClick={() => onPick(o.path)}
            className="flex flex-col gap-1 items-center border border-lightgray hover:border-red rounded-md p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.path} alt="" className="h-24 object-contain" loading="lazy" />
            <span className="text-xs break-all">{o.label}</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}

export default EventImageDialog
