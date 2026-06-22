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
  pre: ({ children }) => (
    <pre
      className="rounded p-2 my-2 overflow-x-auto text-sm"
      style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #1a1b23)' }}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="border-l-2 pl-3 my-2 opacity-80"
      style={{ borderColor: 'var(--tg-theme-hint-color, #AAABAD)' }}
    >
      {children}
    </blockquote>
  ),
}

const separatorStyle = { borderColor: 'var(--tg-theme-section-separator-color, rgba(255,255,255,0.15))' }

function parseTable(block: string): { headers: string[]; rows: string[][] } | null {
  const lines = block.trim().split('\n')
  if (lines.length < 2) return null

  const parseRow = (line: string) =>
    line.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length)

  const headers = parseRow(lines[0])
  if (headers.length === 0) return null
  if (!/^\|?[\s\-:|]+\|?$/.test(lines[1])) return null

  const rows = lines.slice(2).map(parseRow)
  return { headers, rows }
}

function splitByTables(text: string): Array<{ type: 'text' | 'table'; content: string }> {
  const lines = text.split('\n')
  const segments: Array<{ type: 'text' | 'table'; content: string }> = []
  let buf: string[] = []
  let inTable = false

  for (const line of lines) {
    const isTableLine = /^\|.+\|/.test(line.trim())

    if (isTableLine && !inTable) {
      if (buf.length > 0) {
        segments.push({ type: 'text', content: buf.join('\n') })
        buf = []
      }
      inTable = true
    } else if (!isTableLine && inTable) {
      segments.push({ type: 'table', content: buf.join('\n') })
      buf = []
      inTable = false
    }

    buf.push(line)
  }

  if (buf.length > 0) {
    segments.push({ type: inTable ? 'table' : 'text', content: buf.join('\n') })
  }

  return segments
}

function TableBlock({ content }: { content: string }) {
  const table = parseTable(content)
  if (!table) return <ReactMarkdown components={components}>{content}</ReactMarkdown>

  return (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse text-sm w-full">
        <thead>
          <tr className="border-b" style={separatorStyle}>
            {table.headers.map((h, j) => (
              <th key={j} className="text-left px-2 py-1 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, j) => (
            <tr key={j} className="border-b" style={separatorStyle}>
              {row.map((cell, k) => (
                <td key={k} className="px-2 py-1">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DescriptionMarkdown({ text }: { text: string }) {
  const segments = splitByTables(text)

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'table' ? (
          <TableBlock key={i} content={seg.content} />
        ) : (
          <ReactMarkdown key={i} components={components}>{seg.content}</ReactMarkdown>
        )
      )}
    </>
  )
}
