import Head from 'next/head'
import PageWrapper from '../components/PageWrapper'
import { getFolder } from '../utils/fileUtils'
import Album from '../components/Album'
import { AGAlbum } from '../types/types'

interface Props {
  albums: AGAlbum[]
}

const Gallery = ({ albums }: Props) => {
  return (
    <PageWrapper>
      <Head>
        <title>Gallery - Aalto Gamers</title>
      </Head>
      <div className="flex justify-center mt-16 ">
        <div className="flex flex-wrap">
          {[
            albums
              // If b > a, Easier to add if you can just increment instead of offset every old album
              .sort((a, b) => b.orderNumber - a.orderNumber)
              .map((album) => <Album album={album} key={album.name} />),
          ]}
        </div>
      </div>
    </PageWrapper>
  )
}

export const getStaticProps = () => ({
  props: { albums: getFolder('albums') },
})

export default Gallery
