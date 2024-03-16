import Head from 'next/head'
import PageWrapper from '../components/PageWrapper'
import { getFolder } from '../utils/fileUtils'
import Album from '../components/Album'
import { AGEvent } from '../types/types'
import Header from '../components/Header'

interface Props {
  events: AGEvent[]
}

const Gallery = ({ events }: Props) => {
  return (
    <PageWrapper>
      <Head>
        <title>Hall of Fame - Aalto Gamers</title>
      </Head>
      <Header>Hall of Fame</Header>
      <div className="flex justify-center mt-16 ">
        <div className="flex flex-wrap gap-16">
          {[
            events.map((event) => (
              <div>
                <Album album={event} key={event.name} />
                <p className="pt-4">1st: Bruh</p>
                <p>2nd: Bruh</p>
                <p>3rd-4th: Bruh</p>
              </div>
            )),
          ]}
        </div>
      </div>
    </PageWrapper>
  )
}

export const getStaticProps = () => ({
  props: { events: getFolder('events') },
})

export default Gallery
