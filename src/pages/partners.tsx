import Head from 'next/head'
import CmsEditLink from '../components/CmsEditLink'
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
      <CmsEditLink cmsPath="collections/partner" label="Edit partners" className="mt-4" />
      <div className="flex mt-20 flex-wrap justify-evenly">
        {partners.map((partner) => (
          <Partner partner={partner} key={partner.name} />
        ))}
      </div>
      <div className="flex flex-col items-center text-center p-20">
        <Markdown>{content}</Markdown>
        <CmsEditLink
          cmsPath="collections/pages/entries/partners"
          label="Edit partners text"
          className="mt-4"
        />
      </div>
    </PageWrapper>
  )
}

export default Partners

export const getStaticProps = () => ({
  props: { partners: getFolder('partners'), ...getFile('partners') },
})
