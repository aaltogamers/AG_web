import Head from 'next/head'
import { getFile, getFolder } from '../utils/fileUtils'
import Banner from '../components/Banner'
import SideInfoBox from '../components/SideInfoBox'
import { AGEvent, LandingInfo } from '../types/types'
import EventShowCase from '../components/EventShowCase'
import ImageShowCase from '../components/ImageShowCase'
import Calendar from '../components/Calendar'

type Props = {
  landingInfos: LandingInfo[]
  events: AGEvent[]
  imageShowCase: {
    images: string[]
  }
}

const Home = ({ landingInfos, events, imageShowCase }: Props) => {
  return (
    <>
      <Head>
        <title>Aalto Gamers</title>
      </Head>
      <Banner />
      <div className="flex justify-center my-16">
        <main className="flex flex-col md:w-2/3">
          {landingInfos.map((info, i) => (
            <SideInfoBox
              landingInfo={info}
              key={info.title}
              isLeft={i % 2 !== 1}
              isSmallImage={i === 0}
            />
          ))}
          <hr className="bg-gray w-full md:my-16" />
          <ImageShowCase images={imageShowCase.images} />
          <hr className="bg-gray w-full md:my-16" />
          <EventShowCase events={events} />
          <Calendar events={events} />
        </main>
      </div>
    </>
  )
}

export default Home

export const getStaticProps = () => ({
  props: {
    landingInfos: getFolder('landingInfos'),
    events: getFolder('events'),
    imageShowCase: getFile('imageShowCase'),
  },
})
