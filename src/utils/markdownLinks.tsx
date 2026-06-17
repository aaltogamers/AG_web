import React from 'react'

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g

export function markdownLinksToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(LINK_RE, '<a href="$2">$1</a>')
}

export function renderDescriptionWithLinks(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const regex = new RegExp(LINK_RE.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        style={{ color: 'var(--tg-theme-link-color, #2481cc)' }}
      >
        {match[1]}
      </a>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length === 1 ? parts[0] : parts
}
