import React from 'react'
import { Link as ScrollLink } from 'react-scroll'
import { Fade } from 'react-awesome-reveal'

const Two = (props) => (
  <section
    id="two"
    className="spotlight style2 left"
    style={{ backgroundImage: `url(AG_images/cs-tournament-fall-2022/cs_image.jpg)` }}
  >
    <span className="image fit main bottom">
      <img src="AG_images/cs-tournament-fall-2022/cs_image.jpg" alt="" />
    </span>
    <div className="content">
      <header>
        <h2>Aalto Gamers CS:GO Fall Tournament 2022</h2>
        <p>Sunday 27.11. to Saturday 3.12.</p>
      </header>
      <p>
        The CS:GO announcements just keep coming! This time, it's our biggest tournament of the fall
        season. Behold the Aalto Gamers CS:GO Fall tournament 2022. Gather up your team of young (or
        old) hitters to compete for a prize pool of a 1000€ or come just to have fun with your best
        mates! Online qualifiers will be held on Sunday 27.11. and the four best teams will face off
        in live finals at Design factory on Saturday 3.12.
      </p>
      <ul className="actions">
        <li>
          <a href="/events-2022-fall-csgo-tournament" className="button">
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

export default Two
