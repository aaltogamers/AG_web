import Head from 'next/head'
import Header from '../components/Header'
import Markdown from '../components/Markdown'
import PageWrapper from '../components/PageWrapper'
import { getFolder, getFile } from '../utils/fileUtils'
import { AGPartner } from '../types/types'
import Partner from '../components/Partner'

type Props = {
  partners: AGPartner[]
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
      <div className="flex mt-20 flex-wrap justify-evenly">
        {partners.map((partner) => (
          <Partner partner={partner} />
        ))}
      </div>
      <div className="flex flex-col items-center text-center p-20">
        <Markdown>{content}</Markdown>
      </div>
    </PageWrapper>
  )
}

export default Partners

export const getStaticProps = () => ({
  props: { partners: getFolder('partners'), ...getFile('partners') },
})
