import ExportedImage from 'next-image-export-optimizer'

type ImgProps = {
  src: string
  alt: string
  className: string
  width: number
  height: number
  isPreview?: boolean
}

const ImageThatWorksWithPreview = ({ src, alt, className, width, height, isPreview }: ImgProps) => {
  return isPreview ? (
    <img src={src} alt={alt} className={className} width={width} height={height} />
  ) : (
    <ExportedImage src={src} alt={alt} className={className} width={width} height={height} />
  )
}

export default ImageThatWorksWithPreview
