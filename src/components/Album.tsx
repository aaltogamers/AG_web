import { AGAlbum } from '../types/types'
import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'

interface Props {
  album: AGAlbum
  isPreview?: boolean
}

const Album = ({ album, isPreview }: Props) => {
  return (
    <a href={album.link} className="w-60 h-60 bg-cover m-8 relative">
      <div className="darkenedBackground absolute l-0 t-0 w-60 h-60 p-8 flex flex-col justify-end z-10">
        <h4>{album.name}</h4>
      </div>
      <ImageThatWorksWithPreview
        src={album.image}
        alt=""
        fill
        className="object-cover"
        isPreview={isPreview || false}
      />
    </a>
  )
}

export default Album
