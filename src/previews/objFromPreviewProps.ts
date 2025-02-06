/* eslint-disable @typescript-eslint/no-explicit-any */
import { PreviewTemplateComponentProps } from 'decap-cms-core'

const objFromPreviewProps = (
  previewTemplateProps: PreviewTemplateComponentProps,
  fields: string[]
) => {
  const data: Map<string, any> = new Map()

  fields.forEach((field) => {
    let fieldName = field
    if (field === 'content') {
      fieldName = 'body'
    }
    data.set(field, previewTemplateProps.entry.getIn(['data', fieldName]))
  })

  return Object.fromEntries(data)
}

export default objFromPreviewProps
