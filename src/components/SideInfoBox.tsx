import React from 'react'
import { Link as ScrollLink } from 'react-scroll'
import Markdown from './Markdown'

interface Props {
  title: string
  subtitle: string
  content: string
  image: string
  link: string
}

const SideInfoBox = ({ title, subtitle, content, image, link }: Props) => (
  <section className="spotlight style2 left" style={{ backgroundImage: `url(images/${image})` }}>
    <span className="image fit main bottom">
      <img src={`images/${image}`} alt={title} />
    </span>
    <div className="content">
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <Markdown>{content}</Markdown>
      <ul className="actions">
        <li>
          <a href={link} className="button">
            Learn More
          </a>
        </li>
      </ul>
    </div>
    <ScrollLink
      to="four"
      className="goto-next"
      activeClass="active"
      smooth
      offset={50}
      duration={1500}
      spy
    >
      Next
    </ScrollLink>
  </section>
)

export default SideInfoBox
