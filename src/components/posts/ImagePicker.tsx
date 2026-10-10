import { useEffect, useState } from 'react'
import { FaArrowLeft, FaArrowRight, FaTimes } from 'react-icons/fa'
import type { AGEvent } from '../../types/types'
import { DEFAULT_EVENT_IMAGE } from '../../utils/eventUtils'
import { fetchSiteImages, uploadImage } from '../../utils/social/postsClient'
import { MAX_IMAGES } from '../../utils/social/render'
import { imagePreviewUrl, type PostImage } from '../../utils/social/types'
import Dialog from '../Dialog'

type Props = {
  value: PostImage[]
  onChange: (images: PostImage[]) => void
  events: AGEvent[]
}

// Picks an existing site image: event images first, then everything under /images
const SiteImageDialog = ({
  events,
  onPick,
  onClose,
}: {
  events: AGEvent[]
  onPick: (path: string) => void
  onClose: () => void
}) => {
  const [images, setImages] = useState<string[] | null>(null)
  const [query, setQuery] = useState('')
  useEffect(() => {
    fetchSiteImages()
      .then((res) => setImages(res.images))
      .catch(() => setImages([]))
  }, [])

  const eventImages = events
    .filter((e) => e.image && e.image !== DEFAULT_EVENT_IMAGE)
    .map((e) => ({ path: e.image, label: e.name }))
    .filter((e, i, all) => all.findIndex((o) => o.path === e.path) === i)
  const q = query.toLowerCase()
  const options = [
    ...eventImages,
    ...(images ?? [])
      .filter((path) => !eventImages.some((e) => e.path === path))
      .map((path) => ({ path, label: path.replace(/^\/images\//, '') })),
  ].filter((o) => !q || o.label.toLowerCase().includes(q) || o.path.toLowerCase().includes(q))

  return (
    <Dialog onClose={onClose} title="Pick a site image" maxWidthClass="max-w-4xl" fullScreenOnMobile>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by event or file name"
        className="p-2 rounded-md bg-white text-black"
      />
      {!images && <div>Loading…</div>}
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

const ImagePicker = ({ value, onChange, events }: Props) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPicking, setIsPicking] = useState(false)
  const isFull = value.length >= MAX_IMAGES

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
        {value.map((image, i) => (
          <div key={`${imagePreviewUrl(image)}-${i}`} className="relative border border-lightgray rounded-md p-1 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreviewUrl(image)} alt="" className="h-24 w-24 object-contain" />
            <div className="flex gap-3 text-lightgray text-sm mt-1">
              <span>{i + 1}</span>
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
        ))}
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
        <button type="button" className="borderbutton" disabled={isFull} onClick={() => setIsPicking(true)}>
          Pick a site image
        </button>
      </div>
      <div className="text-sm text-lightgray">
        Up to {MAX_IMAGES}. Uploads are converted to JPEG. Instagram needs at least one image, between 4:5 and 1.91:1.
      </div>
      {error && <div className="text-red text-sm">{error}</div>}
      {isPicking && (
        <SiteImageDialog
          events={events}
          onClose={() => setIsPicking(false)}
          onPick={(sitePath) => {
            onChange([...value, { sitePath }])
            setIsPicking(false)
          }}
        />
      )}
    </div>
  )
}

export default ImagePicker
