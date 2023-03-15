import Head from 'next/head'
import { getFolder } from '../utils/fileUtils'
import Banner from '../components/Banner'
import MainInfoBox from '../components/MainInfoBox'
import SideInfoBox from '../components/SideInfoBox'

type Props = {
  landingInfos: LandingInfo[]
}

type LandingInfo = {
  title: string
  subtitle: string
  content: string
  image: string
  link: string
}

const Home = ({ landingInfos }: Props) => {
  return (
    <>
      <Head>
        <title>Aalto Gamers</title>
      </Head>
      <Banner />
      <MainInfoBox />
      {landingInfos.map((landingInfo) => (
        <SideInfoBox landingInfo={landingInfo} key={landingInfo.title} />
      ))}
    </>
  )
}

export default Home

export const getStaticProps = () => ({
  props: { landingInfos: getFolder('landingInfos') },
})
