import { useRef, type KeyboardEvent, type RefObject } from 'react'
import type { IconType } from 'react-icons'
import {
  FaBold,
  FaClipboardList,
  FaCode,
  FaDiscord,
  FaDoorOpen,
  FaItalic,
  FaLink,
  FaListOl,
  FaListUl,
  FaMapMarkerAlt,
  FaQuoteRight,
  FaRedo,
  FaRegCalendarAlt,
  FaRegClock,
  FaTelegramPlane,
  FaUndo,
} from 'react-icons/fa'
import type { PlaceholderOptions } from '../../utils/social/types'

type Props = {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  // Height of the empty editor, in lines
  rows?: number
  disabled?: boolean
  // Buttons for adding {{link:discord}}, {{date}} etc., for what the text can refer
  // to; all by default, null where placeholders aren't filled in
  placeholders?: PlaceholderOptions | null
}

type Edit = {
  // The range to replace and its new text
  from: number
  to: number
  text: string
  // The selection afterwards
  selectFrom: number
  selectTo: number
}

const ToolButton = ({
  Icon,
  label,
  onClick,
}: {
  Icon: IconType
  label: string
  onClick: () => void
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    // Keep the textarea's selection
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className="p-1.5 rounded text-gray-600 hover:bg-gray-200"
  >
    <Icon size={14} />
  </button>
)

// Links: the selected text, or this text when nothing is selected
const PLACEHOLDER_LINKS = [
  { Icon: FaDiscord, label: 'Discord link', href: '{{link:discord}}', text: 'AG Discord' },
  { Icon: FaTelegramPlane, label: 'Telegram link', href: '{{link:telegram}}', text: 'AG Telegram' },
]
const EVENT_PLACEHOLDERS = [
  { Icon: FaRegCalendarAlt, label: 'Date', text: '{{date}}' },
  { Icon: FaRegClock, label: 'Time', text: '{{time}}' },
  { Icon: FaMapMarkerAlt, label: 'Location', text: '{{location}}' },
]

// Adds or removes a marker like ** around the selection. Whitespace at the
// selection's ends stays outside, as Markdown needs.
const toggleWrap = (value: string, start: number, end: number, marker: string): Edit => {
  const selected = value.slice(start, end)
  const from = start + (selected.length - selected.trimStart().length)
  const to = Math.max(from, end - (selected.length - selected.trimEnd().length))
  const inner = value.slice(from, to)
  const m = marker.length
  if (value.slice(from - m, from) === marker && value.slice(to, to + m) === marker) {
    return { from: from - m, to: to + m, text: inner, selectFrom: from - m, selectTo: to - m }
  }
  if (inner.length >= 2 * m && inner.startsWith(marker) && inner.endsWith(marker)) {
    const text = inner.slice(m, -m)
    return { from, to, text, selectFrom: from, selectTo: from + text.length }
  }
  return { from, to, text: `${marker}${inner}${marker}`, selectFrom: from + m, selectTo: to + m }
}

const LINE_PREFIXES = {
  bullet: /^\s*[-*+] /,
  ordered: /^\s*\d+[.)] /,
  quote: /^> ?/,
}

// Adds or removes a list or quote prefix on the selected lines
const toggleLines = (value: string, start: number, end: number, kind: keyof typeof LINE_PREFIXES): Edit => {
  const from = value.lastIndexOf('\n', start - 1) + 1
  // A selection ending at a line's start doesn't include that line
  const lastEnd = end > start && value[end - 1] === '\n' ? end - 1 : end
  const newline = value.indexOf('\n', lastEnd)
  const to = newline === -1 ? value.length : newline
  const lines = value.slice(from, to).split('\n')
  const prefix = LINE_PREFIXES[kind]
  const used = lines.filter((line) => line.trim())
  const remove = used.length > 0 && used.every((line) => prefix.test(line))
  let n = 0
  const text = lines
    .map((line) => {
      if (remove) return line.replace(prefix, '')
      if (!line.trim()) return line
      // A bulleted list becomes a numbered one and the other way round
      const plain = kind === 'quote' ? line : line.replace(LINE_PREFIXES.bullet, '').replace(LINE_PREFIXES.ordered, '')
      n += 1
      return `${kind === 'bullet' ? '- ' : kind === 'ordered' ? `${n}. ` : '> '}${plain}`
    })
    .join('\n')
  return { from, to, text, selectFrom: from, selectTo: from + text.length }
}

const Toolbar = ({
  textarea,
  apply,
  placeholders,
}: {
  textarea: RefObject<HTMLTextAreaElement | null>
  apply: (edit: (value: string, start: number, end: number) => Edit | null) => void
  placeholders: PlaceholderOptions | null
}) => {
  const wrap = (marker: string) => () => apply((v, s, e) => toggleWrap(v, s, e, marker))
  const lines = (kind: keyof typeof LINE_PREFIXES) => () => apply((v, s, e) => toggleLines(v, s, e, kind))
  const insertLink = (href: string, fallback: string) =>
    apply((v, s, e) => {
      const label = v.slice(s, e) || fallback
      const text = `[${label}](${href})`
      return { from: s, to: e, text, selectFrom: s + text.length, selectTo: s + text.length }
    })
  const setLink = () => {
    const url = window.prompt('Link address (or a placeholder like {{signup}})')
    if (url?.trim()) insertLink(url.trim(), url.trim())
  }
  const insertText = (text: string) =>
    apply((_, s, e) => ({ from: s, to: e, text, selectFrom: s + text.length, selectTo: s + text.length }))
  const history = (command: 'undo' | 'redo') => () => {
    textarea.current?.focus()
    document.execCommand(command)
  }
  const { signupSessions } = placeholders ?? {}
  // Several sign-up forms: ask which session's
  const insertSignupLink = (sessions: string[]) => {
    if (!sessions.length) return insertLink('{{signup}}', 'Sign up here')
    const session =
      sessions.length === 1 ? sessions[0] : window.prompt(`Which session's sign-up? (${sessions.join(', ')})`, sessions[0])
    if (session?.trim()) insertLink(`{{signup:${session.trim()}}}`, 'Sign up here')
  }
  return (
    <>
      <ToolButton Icon={FaBold} label="Bold (Ctrl+B)" onClick={wrap('**')} />
      <ToolButton Icon={FaItalic} label="Italic (Ctrl+I)" onClick={wrap('_')} />
      <ToolButton Icon={FaCode} label="Code" onClick={wrap('`')} />
      <ToolButton Icon={FaLink} label="Link" onClick={setLink} />
      <ToolButton Icon={FaListUl} label="Bulleted list" onClick={lines('bullet')} />
      <ToolButton Icon={FaListOl} label="Numbered list" onClick={lines('ordered')} />
      <ToolButton Icon={FaQuoteRight} label="Quote" onClick={lines('quote')} />
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <ToolButton Icon={FaUndo} label="Undo" onClick={history('undo')} />
      <ToolButton Icon={FaRedo} label="Redo" onClick={history('redo')} />
      {placeholders && (
        <>
          <span className="w-px h-5 bg-gray-300 mx-1" />
          {PLACEHOLDER_LINKS.map((l) => (
            <ToolButton key={l.href} Icon={l.Icon} label={l.label} onClick={() => insertLink(l.href, l.text)} />
          ))}
          {signupSessions && (
            <ToolButton Icon={FaClipboardList} label="Sign-up link" onClick={() => insertSignupLink(signupSessions)} />
          )}
          {placeholders.event &&
            EVENT_PLACEHOLDERS.map((p) => (
              <ToolButton key={p.text} Icon={p.Icon} label={p.label} onClick={() => insertText(p.text)} />
            ))}
          {signupSessions && (
            <ToolButton Icon={FaDoorOpen} label="When sign-up opens" onClick={() => insertText('{{signupOpens}}')} />
          )}
        </>
      )}
    </>
  )
}

// For text used in many posts, like channel footers
const ALL_PLACEHOLDERS: PlaceholderOptions = { event: true, signupSessions: [] }

// A Markdown text area with formatting buttons that write the Markdown
const MarkdownEditor = ({ value, onChange, placeholder, rows = 4, disabled = false, placeholders = ALL_PLACEHOLDERS }: Props) => {
  const textarea = useRef<HTMLTextAreaElement>(null)

  const apply = (edit: (value: string, start: number, end: number) => Edit | null) => {
    const el = textarea.current
    if (!el) return
    const change = edit(el.value, el.selectionStart, el.selectionEnd)
    if (!change) return
    el.focus()
    el.setSelectionRange(change.from, change.to)
    // Typing the text keeps the browser's undo history
    if (document.execCommand('insertText', false, change.text)) {
      el.setSelectionRange(change.selectFrom, change.selectTo)
    } else {
      onChange(el.value.slice(0, change.from) + change.text + el.value.slice(change.to))
      requestAnimationFrame(() => el.setSelectionRange(change.selectFrom, change.selectTo))
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
    const marker = { b: '**', i: '_' }[e.key.toLowerCase()]
    if (!marker) return
    e.preventDefault()
    apply((v, s, end) => toggleWrap(v, s, end, marker))
  }

  return (
    <div className={`rounded-md border border-gray-300 bg-white text-black ${disabled ? 'opacity-70' : ''}`}>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-1 py-1">
          <Toolbar textarea={textarea} apply={apply} placeholders={placeholders} />
        </div>
      )}
      <textarea
        ref={textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{ minHeight: `${rows * 1.6 + 1}rem` }}
        className="block w-full p-2 font-mono text-sm rounded-b-md !border-0 outline-none"
      />
    </div>
  )
}

export default MarkdownEditor
