import React from 'react'
import { LandingInfo } from '../types/types'
import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'
import Markdown from './Markdown'

type Props = {
  landingInfo: LandingInfo
  isLeft: boolean
  isSmallImage?: boolean
}

const SideInfoBox = ({ landingInfo, isLeft }: Props) => {
  const { title, subtitle, content, image, isSmallImage } = landingInfo
  return (
    <section
      className={`flex flex-col text-center md:text-start md:flex-row gap-8 items-center py-8  
      ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} `}
    >
      <ImageThatWorksWithPreview
        src={image}
        alt={title}
        className={`object-cover md:w-1/2 h-full border-red border-t-8 md:border-t-0
        ${!isSmallImage && (isLeft ? 'md:border-l-8' : 'md:border-r-8')}
        ${isSmallImage && 'hidden md:block md:px-16 object-scale-down'} `}
        isPreview={false}
      />
      <div className=" bg-black flex flex-col md:w-1/2">
        <h2 className="pb-2">{title}</h2>
        <h3 className="mt-2 mb-4">{subtitle}</h3>
        <div className="px-8 md:px-0 text-lightgray text-xl">
          <Markdown>{content}</Markdown>
        </div>
      </div>
    </section>
  )
}

export default SideInfoBox
