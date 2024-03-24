import React from 'react'
import { LandingInfo } from '../types/types'
import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'
import Markdown from './Markdown'

type Props = {
  landingInfo: LandingInfo
  isLeft: boolean
  isSmallImage?: boolean
}

const SideInfoBox = ({ landingInfo, isLeft, isSmallImage }: Props) => {
  const { title, subtitle, content, image } = landingInfo
  return (
    <section className={`flex gap-8 items-center py-8 ${isLeft && 'flex-row-reverse'} `}>
      <div className=" bg-black flex flex-col w-1/2">
        <h2 className="pb-2">{title}</h2>
        <h3 className="mt-2 mb-4">{subtitle}</h3>
        <div className=" text-lightGray text-xl">
          <Markdown>{content}</Markdown>
        </div>
      </div>
      <ImageThatWorksWithPreview
        src={image}
        alt={title}
        className={`object-cover w-1/2 h-full border-red
        ${!isSmallImage && (isLeft ? 'border-l-8' : 'border-r-8')}
        ${isSmallImage && 'px-16 object-scale-down'} `}
        isPreview={false}
      />
    </section>
  )
}

export default SideInfoBox
