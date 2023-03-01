import React from 'react'
import { Link as ScrollLink } from 'react-scroll'

interface Props {
  title: string
  subtitle: string
  content: string
  image: string
  imageAltText: string
  link: string
}

const SideInfoBox = ({ title, subtitle, content, image, imageAltText, link }: Props) => (
  <section className="spotlight style2 left" style={{ backgroundImage: `url(images/${image})` }}>
    <span className="image fit main bottom">
      <img src={`images/${image}`} alt={imageAltText} />
    </span>
    <div className="content">
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <p>{content}</p>
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
