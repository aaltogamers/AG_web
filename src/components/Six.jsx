import React from 'react'
import { Link as ScrollLink } from 'react-scroll'
import { Fade } from 'react-awesome-reveal'

const pic04 = 'AG_images/pokemon_go.jpg'

const Six = (props) => (
  <section id="six" className="spotlight style3 left" style={{ backgroundImage: `url(${pic04})` }}>
    <span className="image fit main bottom">
      <img src={pic04} alt="" />
    </span>
    <div className="content">
      <header>
        <h2>Join us!</h2>
        <p>Become a member of the Aalto Gamers community</p>
      </header>
      <p>
        You may follow our news through our channels, or you may become a more active member.
        Participate and organise!
      </p>
      <ul className="actions">
        <li>
          <a href="/join" className="button">
            Learn More
          </a>
        </li>
      </ul>
    </div>
    <ScrollLink
      to="banner"
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

export default Six
