import React from 'react'
import ScrollLink from './ScrollLink'

const MainInfoBox = () => {
  return (
    <section
      id="mainInfo"
      className="md:bg-[url('/images/landing-hearthstone.jpg')] relative min-h-screen flex flex-col justify-end bg-center md:bg-fixed bg-cover"
    >
      <div className="h-full min-h-[300px] bg-[url('/images/landing-hearthstone.jpg')] bg-cover bg-center md:hidden" />
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 py-16 bg-black bg-opacity-90 w-full border-t-8 border-red text-center md:text-left">
          <header className="pb-8 md:pb-0 mx-8">
            <h2>Who are we?</h2>
            <h3>Aalto Gamers is a gaming community based in Aalto University.</h3>
          </header>
          <p className="pb-8 md:pb-0 mx-8 text-lightGray text-lg md:text-xl">
            We organise high quality tournaments as well as more casual and regular gaming nights.
            The games we play in our events can rage from very easy party games such as Jackbox to
            big esports games like League of Legends and CS:GO. There is something for everyone.
          </p>
          <p className="mx-8 text-lightGray text-lg md:text-xl">
            Ultimately, our mission is to build a gaming community, where students can connect
            through gaming. We want to reach every player regardless whether you play regularly or
            just once a year, or whether you just started or have played for 10 years. Gaming is
            about the people you play with.
          </p>
        </div>
      </div>
      <ScrollLink to="sideInfo1" />
    </section>
  )
}
export default MainInfoBox
