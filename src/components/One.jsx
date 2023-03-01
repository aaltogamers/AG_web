import React from 'react'
import { Link as ScrollLink } from 'react-scroll'
import { Fade } from 'react-awesome-reveal'

const One = (props) => (
  <section
    id="one"
    className="style1 bottom spotlight"
    style={{ backgroundImage: `url(AG_images/kuva_AG_3.jpg)` }}
  >
    <span className="image fit main">
      <img src="AG_images/kuva_AG_3.jpg" alt="" />
    </span>
    <div className="content">
      <div className="container">
        <div className="row">
          <div className="col-4 col-12-medium">
            <header>
              <h2>Who are we?</h2>ges
              <p>Aalto Gamers is a gaming community based in Aalto University.</p>
            </header>
          </div>
          <div className="col-4 col-12-medium">
            <p>
              We organise high quality tournaments as well as more casual and regular gaming nights.
              The games we play in our events can rage from very easy party games such as Jackbox to
              big esports games like League of Legends and CS:GO. There is something for everyone.
            </p>
          </div>
          <div className="col-4 col-12-medium">
            <p>
              Ultimately, our mission is to build a gaming community, where students can connect
              through gaming. We want to reach every player regardless whether you play regularly or
              just once a year, or whether you just started or have played for 10 years. Gaming is
              about the people you play with.
            </p>
          </div>
        </div>
      </div>
    </div>
    <ScrollLink
      to="two"
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
export default One
