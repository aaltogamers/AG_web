import React from 'react'
import ReactMarkdown, { Components } from 'react-markdown'

export function markdownToTelegramHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
}

const components: Components = {
  p: ({ children }) => <span>{children}</span>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline"
      style={{ color: 'var(--tg-theme-link-color, #2481cc)' }}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  del: ({ children }) => <s>{children}</s>,
  code: ({ children }) => (
    <code
      className="px-1 rounded"
      style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)' }}
    >
      {children}
    </code>
  ),
  ul: ({ children }) => <ul className="list-disc list-inside mt-4 mb-8">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mt-4 mb-8">{children}</ol>,
  li: ({ children }) => <li className="mb-2">{children}</li>,
}

export function DescriptionMarkdown({ text }: { text: string }) {
  return <ReactMarkdown components={components}>{text}</ReactMarkdown>
}
