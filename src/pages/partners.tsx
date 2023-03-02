import Head from 'next/head'

import Header from '../components/Header'
import Markdown from '../components/Markdown'
import { getFolder, getFile } from '../utils/fileUtils'

type Partner = {
  name: string
  image: string
  description: string
  finnishLink: string
  englishLink: string
  content: string
}

type Props = {
  partners: Partner[]
  title: string
  content: string
}

const Partners = ({ partners, title, content }: Props) => {
  return (
    <>
      <Head>
        <title>Partners - Aalto Gamers</title>
      </Head>
      <Header>{title}</Header>
      <div className="flex mt-20 flex-wrap justify-around">
        {partners.map((partner) => (
          <div key={partner.name} className="flex flex-col items-center px-8 max-w-xl text-center">
            <img src={partner.image} alt={`${partner.name} logo`} />
            <h3>{partner.name}</h3>
            <Markdown>{partner.content}</Markdown>
          </div>
        ))}
      </div>
      <div className="flex flex-col p-20">
        <Markdown>{content}</Markdown>
      </div>
    </>
  )
}

export default Partners

export const getStaticProps = () => ({
  props: { partners: getFolder('partners'), ...getFile('partners') },
})
