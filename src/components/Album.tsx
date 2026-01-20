import Link from 'next/link'

import AGImage from './AGImage'
import { LycheeAlbum } from '../types/types'
import { LYCHEE_BASE_URL } from '../utils/constants'

interface Props {
  album: LycheeAlbum
}

const Album = ({ album }: Props) => {
  return (
    <Link
      href={`${LYCHEE_BASE_URL}/gallery/${album.id}`}
      className="w-60 h-60 bg-cover m-8 relative"
    >
      <div className="darkenedBackground absolute l-0 t-0 w-60 h-60 p-8 flex flex-col justify-end z-10">
        <h4>{album.title}</h4>
      </div>
      <AGImage
        src={album.thumb?.thumb || ''}
        alt={album.title}
        className="object-cover w-full h-full"
      />
    </Link>
  )
}

export default Album
