import { ReactNode } from 'react'

// Shows Telegram HTML (b i u s a code pre blockquote) as React elements, without
// dangerouslySetInnerHTML; links only when they are http(s)
const TAG = /<(\/?)(b|i|u|s|a|code|pre|blockquote)(?:\s+href="([^"]*)")?>/g

const unescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

type Node = { tag: string; href?: string; children: (Node | string)[] }

const parse = (html: string): Node => {
  const root: Node = { tag: 'root', children: [] }
  const stack = [root]
  let last = 0
  for (const match of html.matchAll(TAG)) {
    const top = stack[stack.length - 1]
    if (match.index > last) top.children.push(unescape(html.slice(last, match.index)))
    last = match.index + match[0].length
    const [, closing, tag, href] = match
    if (closing) {
      if (stack.length > 1 && top.tag === tag) stack.pop()
    } else {
      const node: Node = { tag, href: href && unescape(href), children: [] }
      top.children.push(node)
      stack.push(node)
    }
  }
  if (last < html.length) stack[stack.length - 1].children.push(unescape(html.slice(last)))
  return root
}

const render = (node: Node | string, key: number): ReactNode => {
  if (typeof node === 'string') return node
  const children = node.children.map(render)
  switch (node.tag) {
    case 'b':
      return <strong key={key}>{children}</strong>
    case 'i':
      return <em key={key}>{children}</em>
    case 'u':
      return <u key={key}>{children}</u>
    case 's':
      return <s key={key}>{children}</s>
    case 'code':
      return (
        <code key={key} className="bg-black px-1 rounded">
          {children}
        </code>
      )
    case 'pre':
      return (
        <pre key={key} className="bg-black p-2 rounded overflow-x-auto">
          {children}
        </pre>
      )
    case 'blockquote':
      return (
        <blockquote key={key} className="border-l-2 border-lightgray pl-3 opacity-80">
          {children}
        </blockquote>
      )
    case 'a':
      return node.href && /^https?:\/\//i.test(node.href) ? (
        <a key={key} href={node.href} target="_blank" rel="noopener noreferrer" className="underline text-[#6ab3f3]">
          {children}
        </a>
      ) : (
        <span key={key}>{children}</span>
      )
    default:
      return <span key={key}>{children}</span>
  }
}

const TelegramHtml = ({ html }: { html: string }) => (
  <div className="whitespace-pre-wrap break-words">{render(parse(html), 0)}</div>
)

export default TelegramHtml
