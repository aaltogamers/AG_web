import { ReactNode } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'

interface ComponentProps {
  children: ReactNode
}

interface MarkdownProps {
  children: string
}

const P = ({ children }: ComponentProps) => <p className="m-0">{children}</p>

const Markdown = ({ children }: MarkdownProps) => {
  const components: Components = {
    p: P,
  }

  return <ReactMarkdown components={components}>{children}</ReactMarkdown>
}

export default Markdown
