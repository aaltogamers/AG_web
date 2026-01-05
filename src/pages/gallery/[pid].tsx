import { GetStaticPropsContext } from 'next'
import Head from 'next/head'
import Header from '../../components/Header'
import PageWrapper from '../../components/PageWrapper'

import { getAlbumImages, getFile, getFolder } from '../../utils/fileUtils'
import { RenderImageContext, RenderImageProps } from 'react-photo-album'
import AGImage from '../../components/AGImage'
import { AGAlbum } from '../../types/types'

import PhotoAlbum from 'react-photo-album'

import 'react-photo-album/rows.css'

type ImageData = {
  filename: string
  width: number
  height: number
}

type Props = {
  images: ImageData[]
  album: AGAlbum
}

const renderNextImage = (
  { alt = '' }: RenderImageProps,
  { photo, width, height }: RenderImageContext
) => {
  return (
    <div
      style={{
        width: '100%',
        position: 'relative',
        aspectRatio: `${width} / ${height}`,
      }}
    >
      <AGImage src={photo.src} alt={alt} />
    </div>
  )
}

const Album = ({ images, album }: Props) => {
  const photos = images.map((image) => ({
    src: `/images/${album.slug}/${image.filename}`,
    width: image.width,
    height: image.height,
  }))

  return (
    <PageWrapper>
      <Head>
        <title>{album.name} - Aalto Gamers</title>
      </Head>
      <Header>{album.name}</Header>
      <div className="my-16">
        <PhotoAlbum
          layout="rows"
          photos={photos}
          render={{ image: renderNextImage }}
          targetRowHeight={600}
        />
      </div>
    </PageWrapper>
  )
}

export default Album

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
