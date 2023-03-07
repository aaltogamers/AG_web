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
      <div className="flex justify-center">
        <div className="flex flex-wrap">
          {[
            albums.map((album) => (
              <a
                href={album.link}
                style={{ backgroundImage: `url(${album.image})` }}
                className="w-60 h-60 bg-cover m-8 bg-center"
              >
                <div className="darkenedBackground w-full h-full p-8 flex flex-col justify-end ">
                  <h4>{album.name}</h4>
                </div>
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
