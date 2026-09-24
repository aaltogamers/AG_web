'use client'
import Image, { ImageLoaderProps } from 'next/image'
import { createContext, useContext } from 'react'

// The CMS preview maps image paths to the URLs the CMS serves them from
// (e.g. blob: URLs for images that haven't been saved yet)
export const ImageUrlOverrides = createContext<Record<string, string>>({})

type ImgProps = {
  src: string
  alt: string
  fill?: boolean
  className?: string
  id?: string
  priority?: boolean
}

const imageLoader = ({ src, width }: ImageLoaderProps) => {
  const withRightFileEnding =
    process.env.NODE_ENV === 'development' ? src : src.replace(/\.(jpe?g|png)$/i, '.webp')
  return `${withRightFileEnding}?w=${width}`
}

const AGImage = ({ src, alt, className, priority }: ImgProps) => {
  const urlOverrides = useContext(ImageUrlOverrides)
  return (
    <Image
      src={urlOverrides[src] || src}
      alt={alt}
      className={className}
      loader={imageLoader}
      priority={priority}
      width={1500}
      height={1500}
    />
  )
}

export default AGImage
