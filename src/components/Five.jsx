import React from 'react'
import { Link as ScrollLink } from 'react-scroll'
import { Fade } from 'react-awesome-reveal'
import csgo_lan_banner from '../../public/AG_images/csgo-lan-spring-2022/csgo-banner.jpg'

const Five = (props) => (
  <section
    id="five"
    className="spotlight style2 right"
    style={{ backgroundImage: `url(${csgo_lan_banner})` }}
  >
    <span className="image fit main">
      <img src={csgo_lan_banner} alt="" />
    </span>
    <div className="content">
      <header>
        <h2>Aalto Gamers CS:GO LAN</h2>
        <p>Thursday 7.4. from 17:00 to 22:00</p>
      </header>
      <p>
        Are you itching for some CS:GO with good company? Well worry no more, we're organising a
        CS:GO lan party at Arkade gaming bar in central Helsinki! Join us for some quality cs
        in-houses and mini-tournaments with a great group and atmosphere.
      </p>
      <ul className="actions">
        <li>
          <a href="/events-2022-spring-csgo-lan" className="button">
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

export default Five
