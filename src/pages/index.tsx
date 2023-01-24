import Head from 'next/head'
import { ReactMarkdown } from 'react-markdown/lib/react-markdown'
import { getFile } from '../utils/fileUtils'

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
      <div>
        <h1>{title}</h1>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </>
  )
}

export default Home

export const getStaticProps = () => ({
  props: getFile('home'),
})
