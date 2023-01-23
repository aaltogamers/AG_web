import Head from 'next/head'
import ReactMarkdown from 'react-markdown'
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
      <div>
        <h1>{title}</h1>
        {partners.map((partner) => (
          <div key={partner.name}>
            <h3>{partner.name}</h3>
            <img src={partner.image} alt={`${partner.name} logo`} />
            <ReactMarkdown>{partner.content}</ReactMarkdown>
          </div>
        ))}
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </>
  )
}

export default Partners

export const getStaticProps = () => ({
  props: { partners: getFolder('partners'), ...getFile('partnerPage') },
})
