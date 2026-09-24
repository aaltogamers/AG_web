import Head from 'next/head'
import Link from 'next/link'
import Header from './Header'
import Markdown from './Markdown'
import PageWrapper from './PageWrapper'
import AGImage from './AGImage'
import SignUpForm from './SignupForm'
import { AGEvent } from '../types/types'
import { LYCHEE_BASE_URL } from '../utils/constants'

type Props = {
  event: AGEvent
  // The CMS preview hides the sign-up form so editors can't sign up by accident
  showSignUp?: boolean
}

const EventPage = ({ event, showSignUp = true }: Props) => {
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
              className="max-h-[500px] object-scale-down md:max-w-[50%] pb-8 aspect-square"
            />
            <div className="mt-8 md:mt-0 md:pl-8 text-lightgray text-xl text-center md:text-left">
              <Markdown>{event.tldr}</Markdown>
            </div>
          </div>
          {event.albumID && (
            <div className="mb-8 flex justify-center w-full">
              <Link href={`${LYCHEE_BASE_URL}/gallery/${event.albumID}`} className="borderbutton ">
                View photos from this event
              </Link>
            </div>
          )}
          <Markdown>{event.content}</Markdown>
          <Markdown>All AG events follow the [AG Safer Space Policy](/safespace).</Markdown>
          {showSignUp && <SignUpForm eventName={event.name} />}
        </div>
      </div>
    </PageWrapper>
  )
}

export default EventPage
