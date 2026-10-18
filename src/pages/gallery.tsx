import Head from 'next/head'
import PageWrapper from '../components/PageWrapper'
import Album from '../components/Album'
import { LycheeAlbum } from '../types/types'
import { fetchLycheeAlbums } from '../utils/lychee'

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
  let albums: LycheeAlbum[]
  try {
    albums = await fetchLycheeAlbums()
  } catch (error) {
    // Don't fail the build if Lychee is down. When revalidating, throwing
    // keeps the last good gallery instead of caching an empty one.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn('Failed to fetch Lychee albums, building empty gallery')
      return { props: { albums: [] }, revalidate: 600 }
    }
    throw error
  }

  return {
    props: { albums },
    revalidate: 600, // Revalidate every 10 minutes
  }
}

export default Gallery
