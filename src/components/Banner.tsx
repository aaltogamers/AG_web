import React from 'react'
import ScrollLink from './ScrollLink'

const Banner = () => (
  <section>
    <div className="bg-[url('/images/home-cover.png')] relative w-full h-[100vh] bg-center bg-fixed bg-cover flex justify-center">
      <header className="flex items-center">
        <div className="flex flex-col text-right text-xl  mr-8">
          <h2 className="mb-8">
            <b>We are Aalto Gamers</b>
          </h2>
          <b>
            Gaming is about the people around you.
            <br />
            The games are only the channel to find those people.
          </b>
        </div>
        <img src="images/logo-white.png" alt="intro" className="object-cover h-80" />
      </header>
    </div>
    <ScrollLink to="mainInfo" />
  </section>
)

export default Banner
