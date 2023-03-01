import React from 'react'
import { Link as ScrollLink } from 'react-scroll'
import { Fade } from 'react-awesome-reveal'

import tft_banner6 from '../../public/AG_images/tft-easter-2022/tft-banner6.jpg'

const Three = (props) => (
  <section id="three" className="style2 right" style={{ backgroundImage: `url(${tft_banner6})` }}>
    <span className="image fit main">
      <img src={tft_banner6} alt="" />
    </span>
    <Fade right big>
      <div className="content">
        <header>
          <h2>Aalto Gamers Easter TFT Tournament</h2>
          <p>Saturday 16.4. from 12:00 to 16:00</p>
        </header>
        <p>
          It's once again time to see who has the best tactics in teamfights! The Aalto Gamers
          Easter TFT Tournament will be held on 16.4. starting at 12:00 on our Discord server!
          Keeping with the Easter theme, there will be lots of eggs as prizes for the best
          tacticians!
        </p>
        <ul className="actions">
          <li>
            <a href="/events-2022-easter-tft" className="button">
              Learn more
            </a>
          </li>
        </ul>
      </div>
    </Fade>
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

export default Three
