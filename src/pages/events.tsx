import Head from 'next/head'
import ReactMarkdown from 'react-markdown'
import { getFolder } from '../utils/fileUtils'

type Event = {
  name: string
  image: string
  time: string
  content: string
  isRecurring: boolean
}

type Props = {
  events: Event[]
}

const Partners = ({ events }: Props) => {
  return (
    <>
      <Head>
        <title>Partners - Aalto Gamers</title>
      </Head>
      <div>
        <h1>Events</h1>
        {events.map((event) => (
          <div key={event.name}>
            <h3>{event.name}</h3>
            <img src={event.image} alt={`${event.name}`} />
            <ReactMarkdown>{event.content}</ReactMarkdown>
          </div>
        ))}
      </div>
    </>
  )
}

export default Partners

export const getStaticProps = () => ({
  props: { partners: getFolder('events') },
})
