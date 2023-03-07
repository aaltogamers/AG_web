import Head from 'next/head'
import ExportedImage from 'next-image-export-optimizer'

import Header from '../components/Header'
import Markdown from '../components/Markdown'
import PageWrapper from '../components/PageWrapper'
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
    <PageWrapper>
      <Head>
        <title>Partners - Aalto Gamers</title>
      </Head>
      <Header>{title}</Header>
      <div className="flex mt-20 flex-wrap justify-between">
        {partners.map((partner) => (
          <div
            key={partner.name}
            className="flex flex-col items-center px-8 max-w-xl text-center mb-24 md:mb-0 md:w-2/5"
          >
            <ExportedImage src={partner.image} alt={partner.name} width={1500} height={1500} />
            <h3 className="pt-12">{partner.name}</h3>
            <Markdown>{partner.content}</Markdown>
            <h3>Contact Partner:</h3>
            {[partner.finnishLink, partner.englishLink].map((link) => (
              <a href={link} className="link text-xl" key={link}>
                {link}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col p-20">
        <Markdown>{content}</Markdown>
      </div>
    </PageWrapper>
  )
}

export default Partners

export const getStaticProps = () => ({
  props: { partners: getFolder('partners'), ...getFile('partners') },
})
