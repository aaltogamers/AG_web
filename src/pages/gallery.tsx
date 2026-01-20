import Head from 'next/head'
import PageWrapper from '../components/PageWrapper'
import Album from '../components/Album'
import { LycheeAlbum } from '../types/types'
import { getLycheeAlbums } from '../utils/lychee'

interface Props {
  albums: LycheeAlbum[]
}

const Gallery = ({ albums }: Props) => {
  return (
    <PageWrapper>
      <Head>
        <title>Gallery - Aalto Gamers</title>
      </Head>
      <div className="flex justify-center mt-16 ">
        <div className="flex flex-wrap">
          {albums.map((album) => (
            <Album album={album} key={album.id} />
          ))}
        </div>
      </div>
    </PageWrapper>
  )
}

export const getStaticProps = async () => {
  const albums = await getLycheeAlbums()

  albums.reverse()

  return {
    props: { albums },
    revalidate: 10, // TODO: adjust as needed
  }
}

export default Gallery
