type ImgProps = {
  src: string
  alt: string
  fill?: boolean
  className?: string
}

const AGImage = ({ src, alt, className, fill }: ImgProps) => {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={fill ? undefined : 1500}
      height={fill ? undefined : 1500}
    />
  )
}

export default AGImage
