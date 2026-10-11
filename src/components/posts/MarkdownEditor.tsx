import { useEffect, useRef, useState } from 'react'
import { InputRule } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import type { Node as PmNode } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { HardBreak } from '@tiptap/extension-hard-break'
import { Placeholder } from '@tiptap/extensions'
import { Markdown, type MarkdownStorage } from 'tiptap-markdown'
import type { IconType } from 'react-icons'
import {
  FaBold,
  FaCode,
  FaItalic,
  FaLink,
  FaListOl,
  FaListUl,
  FaQuoteRight,
  FaRedo,
  FaStrikethrough,
  FaUndo,
} from 'react-icons/fa'

type Props = {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  // Height of the empty editor, in lines
  rows?: number
  disabled?: boolean
  // Buttons for adding {{link:discord}}, {{date}} etc.; off where they aren't filled in
  placeholders?: boolean
}

// A line break is a plain newline, like Telegram shows it (the editor reads
// newlines as line breaks), instead of Markdown's backslash
const LineBreak = HardBreak.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (text: string) => void }, node: PmNode, parent: PmNode, index: number) {
          // Not at the end of a paragraph
          for (let i = index + 1; i < parent.childCount; i++) {
            if (parent.child(i).type !== node.type) {
              state.write('\n')
              return
            }
          }
        },
      },
    }
  },
})

// Typing Markdown link syntax, [text](address), makes a link, instead of text
// that is saved with escaped brackets
const MarkdownLink = Link.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /\[([^[\]]+)\]\((\{\{[^}]*\}\}|<[^>]+>|[^\s()]+)\)$/,
        handler: ({ state, range, match }) => {
          const href = match[2].replace(/^<(.*)>$/, '$1')
          const marks = state.doc.resolve(range.from).marks()
          state.tr
            .replaceWith(range.from, range.to, state.schema.text(match[1], [...marks, this.type.create({ href })]))
            .removeStoredMark(this.type)
        },
      }),
    ]
  },
})

// Placeholder link targets can have spaces ({{signup:Day 1}}), which Markdown allows only in <>
const toEditor = (markdown: string) => markdown.replace(/\]\((\{\{[^}]*\}\})\)/g, '](<$1>)')

// Placeholders ({{signup}} etc.) are filled in the raw Markdown, so undo the
// editor's escaping inside them, and its URL encoding of them in link targets
const fixPlaceholders = (markdown: string) =>
  markdown
    .replace(/%7B%7B(.*?)%7D%7D/gi, (_, inner: string) => `{{${decodeURIComponent(inner)}}}`)
    .replace(/\{\{[^}]*\}\}/g, (placeholder) => placeholder.replace(/\\([\\`*_[\]~#+\-.!()])/g, '$1'))

const getMarkdown = (editor: Editor) =>
  fixPlaceholders((editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown())

const ToolButton = ({
  Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  Icon: IconType
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    // Keep the editor's selection
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`p-1.5 rounded ${active ? 'bg-gray-200 text-black' : 'text-gray-600'} hover:bg-gray-200 disabled:opacity-40`}
  >
    <Icon size={14} />
  </button>
)

const InsertButton = ({ label, title, onClick }: { label: string; title: string; onClick: () => void }) => (
  <button
    type="button"
    title={title}
    // Keep the editor's selection
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className="px-1.5 py-0.5 rounded text-xs text-gray-600 hover:bg-gray-200"
  >
    {label}
  </button>
)

// Links: the selected text, or this text when nothing is selected
const PLACEHOLDER_LINKS = [
  { label: 'Discord', href: '{{link:discord}}', text: 'AG Discord' },
  { label: 'Telegram', href: '{{link:telegram}}', text: 'AG Telegram' },
  { label: 'Sign-up', href: '{{signup}}', text: 'Sign up here' },
]
const PLACEHOLDER_TEXTS = [
  { label: 'Date', text: '{{date}}' },
  { label: 'Time', text: '{{time}}' },
  { label: 'Location', text: '{{location}}' },
  { label: 'Sign-up opens', text: '{{signupOpens}}' },
]

const Toolbar = ({ editor, placeholders }: { editor: Editor; placeholders: boolean }) => {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const chain = () => editor.chain().focus()
  const setLink = () => {
    const current = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link address (or a placeholder like {{signup}}); empty removes the link', current ?? '')
    if (url === null) return
    if (!url.trim()) chain().extendMarkRange('link').unsetLink().run()
    else chain().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }
  const insertLink = (href: string, text: string) => {
    if (!editor.state.selection.empty) chain().setLink({ href }).run()
    else chain().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }).unsetMark('link').run()
  }
  return (
    <>
      <ToolButton Icon={FaBold} label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()} />
      <ToolButton Icon={FaItalic} label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolButton
        Icon={FaStrikethrough}
        label="Strikethrough"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <ToolButton Icon={FaCode} label="Code" active={state.code} onClick={() => chain().toggleCode().run()} />
      <ToolButton Icon={FaLink} label="Link" active={state.link} onClick={setLink} />
      <ToolButton
        Icon={FaListUl}
        label="Bulleted list"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        Icon={FaListOl}
        label="Numbered list"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        Icon={FaQuoteRight}
        label="Quote"
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <ToolButton Icon={FaUndo} label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton Icon={FaRedo} label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
      {placeholders && (
        <>
          <span className="w-px h-5 bg-gray-300 mx-1" />
          {PLACEHOLDER_LINKS.map((l) => (
            <InsertButton
              key={l.label}
              label={l.label}
              title={`Link to ${l.href}`}
              onClick={() => insertLink(l.href, l.text)}
            />
          ))}
          {PLACEHOLDER_TEXTS.map((p) => (
            <InsertButton
              key={p.label}
              label={p.label}
              title={`Add ${p.text}`}
              onClick={() => chain().insertContent(p.text).run()}
            />
          ))}
        </>
      )}
    </>
  )
}

// A visual Markdown editor, with a switch to the Markdown source
const MarkdownEditor = ({ value, onChange, placeholder, rows = 4, disabled = false, placeholders = true }: Props) => {
  const [source, setSource] = useState(false)
  // The last Markdown the editor gave, so that its own changes aren't loaded back into it
  const emitted = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        underline: false,
        hardBreak: false,
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      MarkdownLink.configure({
        openOnClick: false,
        autolink: true,
        isAllowedUri: (url, { defaultValidate }) => /^(\{\{|%7B%7B)/i.test(url.trim()) || defaultValidate(url),
      }),
      LineBreak,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Markdown.configure({ html: false, tightLists: true, linkify: false, breaks: true, transformPastedText: true }),
    ],
    content: toEditor(value),
    onUpdate: ({ editor: e }) => {
      const markdown = getMarkdown(e)
      emitted.current = markdown
      onChangeRef.current(markdown)
    },
  })

  useEffect(() => {
    if (!editor || value === emitted.current) return
    emitted.current = value
    editor.commands.setContent(toEditor(value), { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  const minHeight = `${rows * 1.6 + 1}rem`
  return (
    <div className={`markdown-editor rounded-md border border-gray-300 bg-white text-black ${disabled ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-1 py-1">
        {editor && !source && !disabled && <Toolbar editor={editor} placeholders={placeholders} />}
        <button
          type="button"
          className="ml-auto text-xs px-2 py-1 rounded text-gray-600 hover:bg-gray-200"
          onClick={() => setSource(!source)}
        >
          {source ? 'Visual editor' : 'Markdown'}
        </button>
      </div>
      {source ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ minHeight }}
          className="block w-full p-2 font-mono text-sm rounded-b-md !border-0 outline-none"
        />
      ) : (
        <EditorContent editor={editor} className="p-2 text-base" style={{ minHeight }} />
      )}
    </div>
  )
}

export default MarkdownEditor
