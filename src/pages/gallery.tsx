import Head from 'next/head'
import ExportedImage from 'next-image-export-optimizer'
import PageWrapper from '../components/PageWrapper'
import { getFolder } from '../utils/fileUtils'

type Album = {
  name: string
  link: string
  image: string
  photoCount: number
}

interface Props {
  albums: Album[]
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
            albums.map((album) => (
              <a href={album.link} className="w-60 h-60 bg-cover m-8 relative">
                <div className="darkenedBackground absolute l-0 t-0 w-60 h-60 p-8 flex flex-col justify-end z-10">
                  <h4>{album.name}</h4>
                </div>
                <ExportedImage src={album.image} alt="" fill className="object-cover" />
              </a>
            )),
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
