import React from 'react'
import pic01 from '../../public/AG_images/logo-white.png'
import { Link as ScrollLink } from 'react-scroll'

const Banner = (props) => (
  <section id="banner">
    <div className="content">
      <header>
        <h2>
          <b>We are Aalto Gamers</b>
        </h2>
        <p>
          <b>
            Gaming is about the people around you.
            <br />
            The games are only the channel to find those people.
          </b>
        </p>
      </header>
      <span className="image">
        <img src={pic01} alt="intro" />
      </span>
    </div>
    <ScrollLink
      to="one"
      className="goto-next"
      activeClass="active"
      smooth={true}
      offset={50}
      duration={1500}
      spy={true}
    >
      Next
    </ScrollLink>
  </section>
)

export default Banner
