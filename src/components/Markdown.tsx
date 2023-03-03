import { ReactNode } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'

interface ComponentProps {
  children: ReactNode
}

interface MarkdownProps {
  children: string
  noMargins?: boolean
}

const PWithOutMargins = ({ children }: ComponentProps) => <p className="m-0">{children}</p>
const PWithMargins = ({ children }: ComponentProps) => <p className="my-4">{children}</p>

const Markdown = ({ children, noMargins = false }: MarkdownProps) => {
  const components: Components = {
    p: noMargins ? PWithOutMargins : PWithMargins,
  }

  return <ReactMarkdown components={components}>{children}</ReactMarkdown>
}

export default Markdown
