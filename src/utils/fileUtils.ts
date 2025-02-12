import matter from 'gray-matter'
import fs from 'fs'

export const getFolder = (folder: string) => {
  const filesInFolder = fs.readdirSync(`./src/content/${folder}`)
  const values = filesInFolder.map((filename) => {
    const file = fs.readFileSync(`./src/content/${folder}/${filename}`, 'utf8')
    const matterData = matter(file)
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
  const matterData = matter(file)
  const fields = matterData.data
  const { content } = matterData
  return {
    ...fields,
    content,
  }
}
