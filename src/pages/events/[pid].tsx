import { GetStaticPropsContext } from 'next'
import Head from 'next/head'
import Header from '../../components/Header'
import Markdown from '../../components/Markdown'
import PageWrapper from '../../components/PageWrapper'
import { AGEvent } from '../../types/types'
import { getFile, getFolder } from '../../utils/fileUtils'

type Props = {
  event: AGEvent
}

const Event = ({ event }: Props) => {
  return (
    <PageWrapper>
      <Head>
        <title>{event.name} - Aalto Gamers</title>
      </Head>
      <Header>{event.name}</Header>
      <div className="flex flex-col items-center">
        <div className="py-16 md:w-3/4">
          <div className="flex flex-col md:flex-row">
            <img src={event.image} alt={event.name} className="max-h-[350px] object-scale-down" />
            <div className="mt-8 md:mt-0 md:pl-8 text-lightGray text-xl text-center md:text-left">
              <Markdown>{event.tldr}</Markdown>
            </div>
          </div>
          <Markdown>{event.content}</Markdown>
        </div>
      </div>
    </PageWrapper>
  )
}

export default Event

export async function getStaticPaths() {
  const events = getFolder('events')
  return {
    paths: events.map((event) => ({ params: { pid: event.slug } })),
    fallback: false,
  }
}

export const getStaticProps = (context: GetStaticPropsContext) => {
  return {
    props: { event: getFile(`events/${context?.params?.pid}`) },
  }
}