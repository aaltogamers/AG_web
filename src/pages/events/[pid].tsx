import { GetStaticPropsContext } from 'next'
import Head from 'next/head'
import Header from '../../components/Header'
import Markdown from '../../components/Markdown'
import PageWrapper from '../../components/PageWrapper'
import { AGEvent } from '../../types/types'
import { getFile, getFolder } from '../../utils/fileUtils'
import AGImage from '../../components/ImageThatWorksWithPreview'
import SignUpForm from '../../components/SignupForm'

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
          <div className="flex flex-col md:flex-row justify-center">
            <AGImage
              src={event.image}
              alt={event.name}
              className="max-h-[500px] object-scale-down md:max-w-[50%] pb-8"
            />
            <div className="mt-8 md:mt-0 md:pl-8 text-lightgray text-xl text-center md:text-left">
              <Markdown>{event.tldr}</Markdown>
            </div>
          </div>
          <Markdown>{event.content}</Markdown>
          <Markdown>All AG events follow the [AG Safer Space Policy](/safespace).</Markdown>
          <SignUpForm eventName={event.name} />
        </div>
      </div>
    </PageWrapper>
  )
}

export default Event

export async function getStaticPaths() {
  const events = getFolder('events')
  console.log(events.map((event) => event.slug))
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
