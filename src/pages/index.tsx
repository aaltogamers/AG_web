import Head from 'next/head'
import { getFolder } from '../utils/fileUtils'
import Layout from '../components/Layout'
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
      <Layout>
        <Banner />
        <MainInfoBox />
        {landingInfos.map(({ title, subtitle, content, image, link }) => (
          <SideInfoBox
            key={title}
            title={title}
            subtitle={subtitle}
            content={content}
            image={image}
            link={link}
          />
        ))}
      </Layout>
    </>
  )
}

export default Home

export const getStaticProps = () => ({
  props: { landingInfos: getFolder('landingInfos') },
})
