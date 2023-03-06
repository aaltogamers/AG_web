import { GetStaticPropsContext } from 'next'
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
      <Header>{event.name}</Header>
      <div className="flex flex-col items-center">
        <div className="py-16 w-3/4">
          <div className="flex">
            <img src={event.image} alt={event.name} className="max-h-[350px] object-scale-down" />
            <div className="pl-8 text-lightGray text-xl">
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
