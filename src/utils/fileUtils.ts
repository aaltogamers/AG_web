import matter from 'gray-matter'
import fs from 'fs'
import jsYaml from 'js-yaml'
import { AGEvent } from '../types/types'
import { normalizeEvent } from './eventUtils'

// JSON schema keeps unquoted times like 2024-05-01T18:00:00 as strings
export const parseMarkdown = (file: string) =>
  matter(file, {
    engines: {
      yaml: (s) => jsYaml.load(s, { schema: jsYaml.JSON_SCHEMA }) as object,
    },
  })

export const getFolder = (folder: string) => {
  const filesInFolder = fs.readdirSync(`./src/content/${folder}`)
  const values = filesInFolder.map((filename) => {
    const file = fs.readFileSync(`./src/content/${folder}/${filename}`, 'utf8')
    const matterData = parseMarkdown(file)
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
  const matterData = parseMarkdown(file)
  const fields = matterData.data
  const { content } = matterData
  return {
    ...fields,
    content,
    slug: fileName,
  }
}

export const getEvents = (): AGEvent[] =>
  getFolder('events').map((raw) => normalizeEvent(raw as Record<string, unknown>))

export const getEvent = (slug: string): AGEvent =>
  normalizeEvent({ ...getFile(`events/${slug}`), slug })
