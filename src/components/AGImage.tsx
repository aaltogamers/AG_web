import Image from 'next/image'

type ImgProps = {
  src: string
  alt: string
  fill?: boolean
  className?: string
}

const AGImage = ({ src, alt, className, fill }: ImgProps) => {
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      width={fill ? undefined : 1500}
      height={fill ? undefined : 1500}
      fill={fill}
      priority
    />
  )
}

export default AGImage
