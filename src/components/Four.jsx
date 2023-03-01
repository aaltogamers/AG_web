import React from 'react'
import { Link as ScrollLink } from 'react-scroll'
import { Slide } from 'react-awesome-reveal'

const pic04 = 'AG_images/kuva_ag_9_new.jpg'

const Four = (props) => (
  <section id="four" className="style2 left spotlight" style={{ backgroundImage: `url(${pic04})` }}>
    <span className="image fit main bottom">
      <img src={pic04} alt="" />
    </span>
    <div className="content">
      <header>
        <h2>Biweekly Tournaments</h2>
        <p>Every other Friday starting at 18</p>
      </header>
      <p>
        Going to League of Legends queue again? Have you wanted to know more gamers and play small
        competitive games? Come to Biweeklies! We organize relaxed gaming nights every other Friday
        starting at 18:00. Join alone or with your friends, the key is to have fun and make friends!
        <br />
        <br />
        The biweeklies are currently held online in our Discord!
      </p>
      <ul className="actions">
        <li>
          <a href="/events-biweekly-1" className="button">
            Learn More
          </a>
        </li>
      </ul>
    </div>
    <ScrollLink
      to="six"
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

export default Four
