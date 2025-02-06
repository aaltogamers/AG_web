import ExportedImage from 'next-image-export-optimizer'
/* eslint-disable @next/next/no-img-element */

type ImgProps = {
  src: string
  alt: string
  fill?: boolean
  className?: string
  isPreview: boolean
}

const ImageThatWorksWithPreview = ({ src, alt, className, isPreview, fill }: ImgProps) => {
  return isPreview ? (
    <img src={src} alt={alt} className={className} />
  ) : (
    <ExportedImage
      src={src}
      alt={alt}
      className={className}
      width={fill ? undefined : 1500}
      height={fill ? undefined : 1500}
      fill={fill}
    />
  )
}

export default ImageThatWorksWithPreview
