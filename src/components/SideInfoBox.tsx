import React from 'react'
import Markdown from './Markdown'
import ScrollLink from './ScrollLink'

interface Props {
  title: string
  subtitle: string
  content: string
  image: string
  link: string
  scrollLinkTo?: string
  scrollLinkId: string
}

const SideInfoBox = ({
  title,
  subtitle,
  content,
  image,
  link,
  scrollLinkTo,
  scrollLinkId,
}: Props) => (
  <section
    id={scrollLinkId}
    style={{ backgroundImage: `url(images/${image})` }}
    className="relative h-[100vh] flex bg-center bg-fixed bg-cover"
  >
    <div className="w-2/5 bg-black bg-opacity-90 border-red border-r-8  flex flex-col justify-start p-8 pt-24">
      <h2>{title}</h2>
      <h3 className="mt-2 mb-4">{subtitle}</h3>
      <div className="my-8">
        <Markdown>{content}</Markdown>
      </div>
      <button className="mainbutton" type="button">
        <a href={link}>Learn More</a>
      </button>
    </div>
    {scrollLinkTo && <ScrollLink to={scrollLinkTo} />}
  </section>
)

export default SideInfoBox
