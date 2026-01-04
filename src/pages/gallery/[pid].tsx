import { GetStaticPropsContext } from 'next'
import Head from 'next/head'
import Header from '../../components/Header'
import PageWrapper from '../../components/PageWrapper'

import { getAlbumImages, getFile, getFolder } from '../../utils/fileUtils'
import AGImage from '../../components/AGImage'
import { AGAlbum } from '../../types/types'

type Props = {
  images: string[]
  album: AGAlbum
}

const Event = ({ images, album }: Props) => {
  return (
    <PageWrapper>
      <Head>
        <title>{album.name} - Aalto Gamers</title>
      </Head>
      <Header>{album.name}</Header>
      <div className="flex flex-row flex-wrap justify-center">
        {images.map((image) => (
          <AGImage
            key={image}
            src={`/images/${album.slug}/${image}`}
            alt={album.name}
            className="h-120 w-fit m-4"
          />
        ))}
      </div>
    </PageWrapper>
  )
}

export default Event

export async function getStaticPaths() {
  const albums = getFolder('albums')

  return {
    paths: albums.map((album) => ({ params: { pid: album.slug } })),
    fallback: false,
  }
}

export const getStaticProps = (context: GetStaticPropsContext) => {
  return {
    props: {
      images: getAlbumImages(context.params?.pid as string),
      album: getFile(`albums/${context?.params?.pid}`),
    },
  }
}
