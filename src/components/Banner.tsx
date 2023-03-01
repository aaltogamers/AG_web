import React from 'react'
import { Link as ScrollLink } from 'react-scroll'

const Banner = () => (
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
        <img src="images/logo-white.png" alt="intro" />
      </span>
    </div>
    <ScrollLink
      to="one"
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

export default Banner
