import React from 'react'
import Markdown from './Markdown'

interface Props {
  title: string
  subtitle: string
  content: string
  image: string
  link: string
}

const SideInfoBox = ({ title, subtitle, content, image, link }: Props) => {
  return (
    <section
      style={{ backgroundImage: `url(images/${image})` }}
      className="relative min-h-screen flex flex-col md:flex-row bg-center bg-fixed bg-cover bg-black text-center md:text-left"
    >
      <div
        style={{ backgroundImage: `url(images/${image})` }}
        className="min-h-[300px] h-full bg-cover bg-center md:hidden"
      />
      <div className="md:w-2/5 bg-black md:bg-opacity-90 border-red border-t-8 md:border-r-8 flex flex-col justify-start p-8 md:pt-24 md:pb-0">
        <h2>{title}</h2>
        <h3 className="mt-2 mb-4">{subtitle}</h3>
        <div className="my-8 text-lightGray text-xl">
          <Markdown>{content}</Markdown>
          <a className="borderbutton" href={link}>
            Learn More
          </a>
        </div>
      </div>
    </section>
  )
}

export default SideInfoBox
