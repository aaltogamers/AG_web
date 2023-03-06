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
const PWithMargins = ({ children }: ComponentProps) => <p className="mt-8 mb-16">{children}</p>
const H1 = ({ children }: ComponentProps) => <h1 className="text-white">{children}</h1>
const H2 = ({ children }: ComponentProps) => <h2 className="text-white">{children}</h2>
const H3 = ({ children }: ComponentProps) => <h3 className="text-white">{children}</h3>
const H4 = ({ children }: ComponentProps) => <h4 className="text-white">{children}</h4>
const H5 = ({ children }: ComponentProps) => <h5 className="text-white">{children}</h5>
const Strong = ({ children }: ComponentProps) => <strong className="text-white">{children}</strong>

const Markdown = ({ children, noMargins = false }: MarkdownProps) => {
  const components: Components = {
    p: noMargins ? PWithOutMargins : PWithMargins,
    h1: H1,
    h2: H2,
    h3: H3,
    h4: H4,
    h5: H5,
    strong: Strong,
  }

  return (
    <ReactMarkdown components={components} className="text-xl text-lightGray">
      {children}
    </ReactMarkdown>
  )
}

export default Markdown
