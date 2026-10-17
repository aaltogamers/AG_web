import { useState } from 'react'
import { FaArrowLeft, FaArrowRight, FaTimes } from 'react-icons/fa'
import { uploadImage } from '../../utils/social/postsClient'
import { MAX_IMAGES } from '../../utils/social/render'
import { imagePreviewUrl, type PostImage } from '../../utils/social/types'

type Props = {
  value: PostImage[]
  onChange: (images: PostImage[]) => void
  // The post has an event (or its website change creates one)
  hasEvent: boolean
  // The image the post's event will have, null if none or not known yet
  eventImage: string | null
}

const ImagePicker = ({ value, onChange, hasEvent, eventImage }: Props) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isFull = value.length >= MAX_IMAGES
  const hasEventImage = value.some((image) => 'eventImage' in image)

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      const added: PostImage[] = []
      for (const file of Array.from(files).slice(0, MAX_IMAGES - value.length)) {
        added.push(await uploadImage(file))
      }
      onChange([...value, ...added])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const move = (i: number, by: number) => {
    const next = [...value]
    const [image] = next.splice(i, 1)
    next.splice(i + by, 0, image)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {value.map((image, i) => {
          const url = imagePreviewUrl(image, eventImage)
          return (
            <div key={`${url}-${i}`} className="relative border border-lightgray rounded-md p-1 flex flex-col items-center">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-24 w-24 object-contain" />
              ) : (
                <div className="h-24 w-24 flex items-center justify-center text-center text-sm text-lightgray">
                  {hasEvent ? 'The event has no image yet' : 'No event'}
                </div>
              )}
              <div className="flex gap-3 text-lightgray text-sm mt-1">
                <span>{'eventImage' in image ? `${i + 1} · Event image` : i + 1}</span>
                {i > 0 && (
                  <button type="button" aria-label="Move left" onClick={() => move(i, -1)}>
                    <FaArrowLeft />
                  </button>
                )}
                {i < value.length - 1 && (
                  <button type="button" aria-label="Move right" onClick={() => move(i, 1)}>
                    <FaArrowRight />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Remove image"
                  className="hover:text-red"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                >
                  <FaTimes />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-base">
        <label className={`borderbutton cursor-pointer ${isFull || busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy ? 'Uploading…' : 'Upload images'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              upload(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <button
          type="button"
          className="borderbutton"
          disabled={isFull || hasEventImage || !hasEvent}
          title={hasEvent ? undefined : "Choose the post's event first"}
          onClick={() => onChange([...value, { eventImage: true }])}
        >
          Use event image
        </button>
      </div>
      <div className="text-sm text-lightgray">
        Up to {MAX_IMAGES}. Uploads are converted to JPEG. The event image is the image the event has when the post
        is sent. Instagram needs at least one image, between 4:5 and 1.91:1.
      </div>
      {error && <div className="text-red text-sm">{error}</div>}
    </div>
  )
}

export default ImagePicker
