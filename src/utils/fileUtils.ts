import matter from 'gray-matter'
import fs from 'fs'
import imageSize from 'image-size'
import jsYaml from 'js-yaml'

export const getFolder = (folder: string) => {
  const filesInFolder = fs.readdirSync(`./src/content/${folder}`)
  const values = filesInFolder.map((filename) => {
    const file = fs.readFileSync(`./src/content/${folder}/${filename}`, 'utf8')
    const matterData = matter(file, {
      engines: {
        yaml: (s) => jsYaml.load(s, { schema: jsYaml.JSON_SCHEMA }) as object,
      },
    })
    const fields = matterData.data
    const { content } = matterData
    return {
      ...fields,
      content,
      slug: filename.slice(0, filename.indexOf('.')),
    }
  })

  return values
}

export const getFile = (fileName: string, folder: string = './src/content/') => {
  const file = fs.readFileSync(`${folder}${fileName}.md`, 'utf8')
  const matterData = matter(file, {
    engines: {
      yaml: (s) => jsYaml.load(s, { schema: jsYaml.JSON_SCHEMA }) as object,
    },
  })
  const fields = matterData.data
  const { content } = matterData
  return {
    ...fields,
    content,
    slug: fileName,
  }
}

export const getAlbumImages = (albumSlug: string) => {
  const images = fs.readdirSync(`./public/images/albums/${albumSlug}`)

  return images.map((filename) => {
    const buffer = fs.readFileSync(`./public/images/albums/${albumSlug}/${filename}`)
    const dimensions = imageSize(buffer)

    return {
      filename,
      width: dimensions.width,
      height: dimensions.height,
    }
  })
}
