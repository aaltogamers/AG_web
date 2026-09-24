import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ImageUrlOverrides } from '../../components/AGImage'
import EventCard from '../../components/Event'
import EventPage from '../../components/EventPage'
import { normalizeEvent } from '../../utils/eventUtils'

// Rendered inside the Decap CMS preview pane (see public/cms/index.html).
// The CMS posts the entry being edited here, and it is rendered with the same
// components as the real site.

type PreviewMessage = {
  type: 'ag-cms-preview'
  event: Record<string, unknown>
  imageUrls: Record<string, string>
}

// Styled like editor UI, not like the site, so it doesn't read as part of the page
const PreviewLabel = ({ children }: { children: string }) => (
  <div
    className="w-full px-4 py-2 border-y border-dashed border-lightgray bg-darkgray text-lightgray text-xs uppercase tracking-widest"
    style={{ fontFamily: 'system-ui, sans-serif' }}
  >
    Preview · {children}
  </div>
)

const EventPreview = () => {
  const [preview, setPreview] = useState<PreviewMessage | null>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent<PreviewMessage>) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'ag-cms-preview') return
      setPreview(e.data)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'ag-cms-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!preview) return null

  const event = normalizeEvent(preview.event)

  return (
    <ImageUrlOverrides.Provider value={preview.imageUrls}>
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <PreviewLabel>Event page</PreviewLabel>
      <EventPage event={event} showSignUp={false} />
      <PreviewLabel>Card on the events page</PreviewLabel>
      <div className="flex flex-col w-full items-center px-8 pb-16">
        <EventCard event={event} />
      </div>
    </ImageUrlOverrides.Provider>
  )
}

export default EventPreview
