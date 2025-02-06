import { PreviewTemplateComponentProps } from 'decap-cms-core'
import { AGAlbum } from '../types/types'
import objFromPreviewProps from './objFromPreviewProps'
import Album from '../components/Album'

const AlbumPreview: React.FC<PreviewTemplateComponentProps> = (props) => {
  const album = objFromPreviewProps(props, ['name', 'image', 'link', 'content']) as AGAlbum
  return (
    <div className="flex justify-center mt-16">
      <div className="flex flex-wrap">
        <Album album={album} isPreview />
      </div>
    </div>
  )
}

export default AlbumPreview
