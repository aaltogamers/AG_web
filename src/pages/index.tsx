import Head from 'next/head'
import { getEvents, getFile, getFolder } from '../utils/fileUtils'
import Banner from '../components/Banner'
import SideInfoBox from '../components/SideInfoBox'
import { AGEvent, LandingInfo } from '../types/types'
import EventShowCase from '../components/EventShowCase'
import ImageShowCase from '../components/ImageShowCase'
import Calendar from '../components/Calendar'
import CmsEditLink from '../components/CmsEditLink'

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
          <CmsEditLink cmsPath="collections/landinginfo" label="Edit landing infos" />
          {landingInfos.map((info, i) => (
            <SideInfoBox
              landingInfo={info}
              key={info.title}
              isLeft={i % 2 !== 1}
              isSmallImage={i === 0}
              priority={i === 0}
            />
          ))}
          <hr className="bg-gray w-full md:my-16" />
          <ImageShowCase images={imageShowCase.images} />
          <CmsEditLink
            cmsPath="collections/pages/entries/imageshowcase"
            label="Edit image showcase"
            className="mt-4"
          />
          <hr className="bg-gray w-full md:my-16" />
          <EventShowCase events={events} />
          <CmsEditLink cmsPath="collections/event" label="Edit events" className="mb-4" />
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
    events: getEvents(),
    imageShowCase: getFile('imageShowCase'),
  },
})
