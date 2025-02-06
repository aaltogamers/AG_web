import { ReactNode } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'

interface ComponentProps {
  children?: ReactNode
}

interface AProps extends ComponentProps {
  href?: string
}

interface MarkdownProps {
  children: string
}

const P = ({ children }: ComponentProps) => <p className="mt-4 mb-8">{children}</p>
const H1 = ({ children }: ComponentProps) => <h1 className="text-white">{children}</h1>
const H2 = ({ children }: ComponentProps) => <h2 className="text-white">{children}</h2>
const H3 = ({ children }: ComponentProps) => <h3 className="text-white">{children}</h3>
const H4 = ({ children }: ComponentProps) => <h4 className="text-white">{children}</h4>
const H5 = ({ children }: ComponentProps) => <h5 className="text-white">{children}</h5>
const Strong = ({ children }: ComponentProps) => <strong className="text-white">{children}</strong>
const A = ({ children, href }: AProps) => (
  <a className="text-white" href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
)
const Ul = ({ children }: ComponentProps) => (
  <ul className="list-disc list-inside mt-4 mb-8">{children}</ul>
)
const Ol = ({ children }: ComponentProps) => (
  <ol className="list-decimal list-inside mt-4 mb-8">{children}</ol>
)
const Li = ({ children }: ComponentProps) => <li className="mb-2">{children}</li>

const Markdown = ({ children }: MarkdownProps) => {
  const components: Components = {
    p: P,
    h1: H1,
    h2: H2,
    h3: H3,
    h4: H4,
    h5: H5,
    strong: Strong,
    a: A,
    ul: Ul,
    ol: Ol,
    li: Li,
  }

  return (
    <ReactMarkdown components={components} className="text-xl text-lightgray">
      {children}
    </ReactMarkdown>
  )
}

export default Markdown
