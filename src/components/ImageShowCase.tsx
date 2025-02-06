import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'
import { useState } from 'react'
import { BsChevronCompactRight, BsChevronCompactLeft } from 'react-icons/bs'
import SmallHeader from './SmallHeader'

type Props = {
  images: string[]
}

const ImageShowCase = ({ images }: Props) => {
  const [currentImage, setCurrentImage] = useState(0)
  const nextImage = () => {
    const isLastImage = currentImage === images.length - 1
    if (isLastImage) {
      setCurrentImage(0)
    } else {
      setCurrentImage((cur) => cur + 1)
    }
  }
  const prevImage = () => {
    const isFirstImage = currentImage === 0
    if (isFirstImage) {
      setCurrentImage(images.length - 1)
    } else {
      setCurrentImage((cur) => cur - 1)
    }
  }
  return (
    <section className="flex flex-col items-center">
      <SmallHeader>Images</SmallHeader>
      <div className="relative md:w-5/6 md:mb-16 md:px-16">
        <ImageThatWorksWithPreview
          src={images[currentImage]}
          alt=""
          isPreview={false}
          className="object-scale-down w-full h-96 md:h-[500px]"
        />
        <button
          className="absolute text-5xl right-0 abs-center-y text-lightgray"
          onClick={nextImage}
        >
          <BsChevronCompactRight />
        </button>
        <button
          className="absolute text-5xl left-0 abs-center-y text-lightgray"
          onClick={prevImage}
        >
          <BsChevronCompactLeft />
        </button>
      </div>
    </section>
  )
}

export default ImageShowCase
