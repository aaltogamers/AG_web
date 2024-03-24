import React from 'react'

const MainInfoBox = () => {
  return (
    <section id="mainInfo" className="text-center">
      <div className="w-2/3">
        <header className="pb-8 md:pb-0 mx-8 ">
          <h2>Who are we?</h2>
          <h3>Aalto Gamers is a gaming community based in Aalto University.</h3>
        </header>
        <div className="flex gap-20 ">
          <p className="pb-8 md:pb-0 mx-8 text-lightGray text-lg md:text-xl">
            We organise high quality tournaments as well as more casual and regular gaming nights.
            The games we play in our events can rage from very easy party games such as Jackbox to
            big esports games like League of Legends and CS 2. There is something for everyone.
          </p>
          <p className="mx-8 text-lightGray text-lg md:text-xl">
            Ultimately, our mission is to build a gaming community, where students can connect
            through gaming. We want to reach every player regardless whether you play regularly or
            just once a year, or whether you just started or have played for 10 years. Gaming is
            about the people you play with.
          </p>
        </div>
      </div>
    </section>
  )
}
export default MainInfoBox
