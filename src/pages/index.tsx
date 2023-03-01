import Head from 'next/head'
import { ReactMarkdown } from 'react-markdown/lib/react-markdown'
import { getFile } from '../utils/fileUtils'
import Layout from '../components/Layout'
import Banner from '../components/Banner'
import MainInfoBox from '../components/MainInfoBox'
import SideInfoBox from '../components/SideInfoBox'

type Props = {
  title: string
  content: string
}

const Home = ({ title, content }: Props) => {
  return (
    <>
      <Head>
        <title>Aalto Gamers</title>
      </Head>
      <Layout>
        <Banner />
        <MainInfoBox />
        <SideInfoBox
          title="Aalto Gamers CS:GO Fall Tournament 2022"
          subtitle="Sunday 27.11. to Saturday 3.12."
          content="The CS:GO announcements just keep coming! This time, it's our biggest tournament of the fall
        season. Behold the Aalto Gamers CS:GO Fall tournament 2022. Gather up your team of young (or
        old) hitters to compete for a prize pool of a 1000€ or come just to have fun with your best
        mates! Online qualifiers will be held on Sunday 27.11. and the four best teams will face off
        in live finals at Design factory on Saturday 3.12."
          image="cs-tournament-fall-2022/cs_image.jpg"
          imageAltText="CS:GO Fall Tournament 2022"
          link="events-2022-fall-csgo-tournament"
        />
      </Layout>
    </>
  )
}

export default Home

export const getStaticProps = () => ({
  props: getFile('home'),
})
