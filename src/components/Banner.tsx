import React from 'react'
import ScrollLink from './ScrollLink'

const Banner = () => (
  <section>
    <div className="bg-[url('/images/landing-cover.png')] relative w-[100vw] h-[100vh] bg-center bg-fixed bg-cover flex justify-center">
      <header className="flex flex-col md:flex-row items-center justify-center">
        <div className="flex flex-col text-center md:text-right text-xl mr-8 m-0">
          <h2 className="mb-8 ">
            <b>We are Aalto Gamers</b>
          </h2>
          <b>
            Gaming is about the people around you.
            <br />
            The games are only the channel to find those people.
          </b>
        </div>
        <img src="images/ag-white.png" alt="intro" className="object-cover h-36 mt-8 md:mt-4" />
      </header>
    </div>
    <ScrollLink to="mainInfo" />
  </section>
)

export default Banner
