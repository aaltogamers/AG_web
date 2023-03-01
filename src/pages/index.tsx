import Head from 'next/head'
import { ReactMarkdown } from 'react-markdown/lib/react-markdown'
import { getFile } from '../utils/fileUtils'
import Layout from '../components/layout'
import Banner from '../components/Banner'
import One from '../components/One'
import Two from '../components/Two'
import Three from '../components/Three'
import Four from '../components/Four'
import Five from '../components/Five'
import Six from '../components/Six'

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
        <One />
        <Two />
        <Four />
        <Six />
      </Layout>
    </>
  )
}

export default Home

export const getStaticProps = () => ({
  props: getFile('home'),
})
