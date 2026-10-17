import { useEffect, useRef, useState } from 'react'
import { FaDesktop, FaMobileAlt } from 'react-icons/fa'
import type { WebsiteChangePreview } from '../../utils/social/types'

type Props = {
  page: NonNullable<WebsiteChangePreview['page']>
}

type Device = 'desktop' | 'mobile'

// The frame is this wide, and scaled down to fit when there's less room
const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, mobile: 390 }

// The event's page and its card on the events page, rendered by the CMS preview
// page (src/pages/cms-preview/event.tsx) in a frame so it lays out like the site
const WebsitePagePreview = ({ page }: Props) => {
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 })

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

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setBoxSize({ width: el.clientWidth, height: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const width = DEVICE_WIDTH[device]
  const scale = boxSize.width ? Math.min(1, boxSize.width / width) : 1

  const deviceButton = (value: Device, label: string, Icon: typeof FaDesktop) => (
    <button
      type="button"
      onClick={() => setDevice(value)}
      aria-pressed={device === value}
      className={`flex items-center gap-1 px-3 py-1 text-sm ${device === value ? 'bg-red text-white' : 'bg-white hover:text-red'}`}
    >
      <Icon /> {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex self-start rounded-md border border-lightgray overflow-hidden">
        {deviceButton('desktop', 'Desktop', FaDesktop)}
        {deviceButton('mobile', 'Mobile', FaMobileAlt)}
      </div>
      <div ref={box} className="w-full h-[75vh] overflow-hidden rounded-md border border-lightgray/30 flex justify-center">
        {/* Scaled down so the page lays out as it does on a screen this wide */}
        <iframe
          ref={frame}
          src="/cms-preview/event"
          title="Event preview"
          className="shrink-0 origin-top"
          style={{
            width,
            height: boxSize.height / scale || '100%',
            transform: `scale(${scale})`,
          }}
        />
      </div>
    </div>
  )
}

export default WebsitePagePreview
