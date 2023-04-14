import { GetStaticPropsContext } from 'next'
import Head from 'next/head'
import Header from '../../components/Header'
import Markdown from '../../components/Markdown'
import PageWrapper from '../../components/PageWrapper'
import { AGEvent } from '../../types/types'
import { getFile, getFolder } from '../../utils/fileUtils'
import ImageThatWorksWithPreview from '../../components/ImageThatWorksWithPreview'
import SignUpForm from '../../components/SignupForm'

type Props = {
  event: AGEvent
  isPreview?: boolean
}

const Event = ({ event, isPreview }: Props) => {
  return (
    <PageWrapper>
      <Head>
        <title>{event.name} - Aalto Gamers</title>
      </Head>
      <Header>{event.name}</Header>
      <div className="flex flex-col items-center">
        <div className="py-16 md:w-3/4">
          <div className="flex flex-col md:flex-row justify-center">
            <ImageThatWorksWithPreview
              src={event.image}
              alt={event.name}
              className="max-h-[500px] object-scale-down md:max-w-[50%] pb-8"
              isPreview={isPreview || false}
            />
            <div className="mt-8 md:mt-0 md:pl-8 text-lightGray text-xl text-center md:text-left">
              <Markdown>{event.tldr}</Markdown>
            </div>
          </div>
          <Markdown>{event.content}</Markdown>
          <SignUpForm eventName={event.name} signupFields={event.signupFields ?? []} />
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
