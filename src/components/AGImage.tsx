'use client'
import Image, { ImageLoaderProps } from 'next/image'

type ImgProps = {
  src: string
  alt: string
  fill?: boolean
  className?: string
  id?: string
}

const imageLoader = ({ src }: ImageLoaderProps) => {
  const withRighFileEnding =
    process.env.NODE_ENV === 'development' ? src : src.replace(/\.(jpe?g|png)$/i, '.webp')
  return withRighFileEnding
}

const AGImage = ({ src, alt, className }: ImgProps) => {
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      width={1500}
      height={1500}
      loader={imageLoader}
    />
  )
}

export default AGImage
