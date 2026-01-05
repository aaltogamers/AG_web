import { GetStaticPropsContext } from 'next'
import Head from 'next/head'
import Header from '../../components/Header'
import Markdown from '../../components/Markdown'
import PageWrapper from '../../components/PageWrapper'
import { AGAlbum, AGEvent } from '../../types/types'
import { getFile, getFolder } from '../../utils/fileUtils'
import AGImage from '../../components/AGImage'
import SignUpForm from '../../components/SignupForm'
import Link from 'next/link'

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
              src={event.image || '/images/ag-white.png'}
              alt={event.name}
              className="max-h-[500px] object-scale-down md:max-w-[50%] pb-8"
            />
            <div className="mt-8 md:mt-0 md:pl-8 text-lightgray text-xl text-center md:text-left">
              <Markdown>{event.tldr}</Markdown>
            </div>
          </div>
          {event.albumSlug && (
            <div className="mb-8 flex justify-center w-full">
              <Link href={`/gallery/${event.albumSlug}`} className="borderbutton ">
                View photos from this event
              </Link>
            </div>
          )}
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

  return {
    paths: events.map((event) => ({ params: { pid: event.slug } })),
    fallback: false,
  }
}

export const getStaticProps = (context: GetStaticPropsContext) => {
  const event = getFile(`events/${context?.params?.pid}`) as unknown as AGEvent

  const albums = getFolder('albums') as unknown as AGAlbum[]

  const linkedAlbum = albums.filter((album) => album.event === event.name)[0]

  event.albumSlug = linkedAlbum?.slug

  if (!event.albumSlug) {
    delete event.albumSlug
  }

  return {
    props: { event: event },
  }
}
