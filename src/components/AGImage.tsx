type ImgProps = {
  src: string
  alt: string
  fill?: boolean
  className?: string
}

const AGImage = ({ src, alt, className }: ImgProps) => {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  )
}

export default AGImage
