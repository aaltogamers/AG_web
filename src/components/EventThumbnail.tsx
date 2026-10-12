import { useState } from 'react'
import { DEFAULT_EVENT_IMAGE } from '../utils/eventUtils'
import { imageLoader } from './AGImage'

// The event's image, or the AG logo if it has none or it doesn't load
const EventThumbnail = ({ image }: { image: string }) => {
  const [failed, setFailed] = useState(false)
  const src = failed || !image ? DEFAULT_EVENT_IMAGE : image
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageLoader({ src, width: 256 })}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`w-full aspect-square rounded-md bg-neutral-950 ${
        src === DEFAULT_EVENT_IMAGE ? 'object-contain p-3' : 'object-cover'
      }`}
    />
  )
}

export default EventThumbnail
