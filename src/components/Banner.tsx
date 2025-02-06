/* eslint-disable @next/next/no-img-element */
import React from 'react'

const Banner = () => (
  <section>
    <div className="bg-[url('/images/landing/cover.webp')] relative h-[100vh] bg-center md:bg-fixed bg-cover flex justify-center border-red border-b-8">
      <div className="absolute inset-0 bg-black opacity-40 z-100" />
      <header className="flex flex-col md:flex-row items-center justify-center relative z-1000">
        <div className="flex flex-col text-center md:text-right mr-8 m-0 font-light">
          <h2 className="mb-8 text-md md:text-5xl">We are Aalto</h2>
          <h4>
            Gaming is about the people around you.
            <br />
            The games are only the channel to find those people.
          </h4>
        </div>
        <img
          src="/images/ag-white.png"
          alt="intro"
          className="object-cover h-32 md:h-40 mt-8 md:mt-4"
        />
      </header>
    </div>
  </section>
)

export default Banner
