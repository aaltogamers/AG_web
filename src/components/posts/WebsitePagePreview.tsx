import { useEffect, useRef, useState } from 'react'
import type { WebsiteChangePreview } from '../../utils/social/types'

type Props = {
  page: NonNullable<WebsiteChangePreview['page']>
}

// The event's page and its card on the events page, rendered by the CMS preview
// page (src/pages/cms-preview/event.tsx) in a frame so it lays out like the site
const WebsitePagePreview = ({ page }: Props) => {
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.type === 'ag-cms-preview-ready') setReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (!ready) return
    frame.current?.contentWindow?.postMessage(
      { type: 'ag-cms-preview', event: page.event, imageUrls: page.imageUrls },
      window.location.origin
    )
  }, [ready, page])

  return (
    <iframe
      ref={frame}
      src="/cms-preview/event"
      title="Event preview"
      className="w-full h-[75vh] rounded-md border border-lightgray/30"
    />
  )
}

export default WebsitePagePreview
