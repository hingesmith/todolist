import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Code, CodeSquare,
  Quote, Link2, Minus, Undo2, Redo2
} from 'lucide-react'

const lowlight = createLowlight(common)

interface WysiwygEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  className?: string
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 self-center shrink-0" />
}

export default function WysiwygEditor({ value, onChange, placeholder, className }: WysiwygEditorProps) {
  const isUpdatingFromEditor = useRef(false)
  const lastEmittedMarkdown = useRef<string>(value)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'ここに記述できます...' }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
    ],
    content: value,
    onUpdate({ editor }) {
      isUpdatingFromEditor.current = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as any).markdown.getMarkdown() as string
      lastEmittedMarkdown.current = md
      onChange(md)
      isUpdatingFromEditor.current = false
    },
  })

  // Sync external value changes (e.g., AI draft load) back into the editor
  useEffect(() => {
    if (!editor || isUpdatingFromEditor.current) return
    if (value === lastEmittedMarkdown.current) return
    editor.commands.setContent(value)
    lastEmittedMarkdown.current = value
  }, [editor, value])

  return (
    <div className={`flex flex-col border border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 bg-white dark:bg-gray-900 ${className ?? ''}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 overflow-x-auto shrink-0">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          active={editor?.isActive('bold')}
          disabled={!editor}
          title="太字 (Ctrl+B)"
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={editor?.isActive('italic')}
          disabled={!editor}
          title="斜体 (Ctrl+I)"
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          active={editor?.isActive('strike')}
          disabled={!editor}
          title="打ち消し線"
        >
          <Strikethrough size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor?.isActive('heading', { level: 1 })}
          disabled={!editor}
          title="見出し1"
        >
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor?.isActive('heading', { level: 2 })}
          disabled={!editor}
          title="見出し2"
        >
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor?.isActive('heading', { level: 3 })}
          disabled={!editor}
          title="見出し3"
        >
          <Heading3 size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive('bulletList')}
          disabled={!editor}
          title="箇条書きリスト"
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive('orderedList')}
          disabled={!editor}
          title="番号付きリスト"
        >
          <ListOrdered size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCode().run()}
          active={editor?.isActive('code')}
          disabled={!editor}
          title="インラインコード"
        >
          <Code size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          active={editor?.isActive('codeBlock')}
          disabled={!editor}
          title="コードブロック"
        >
          <CodeSquare size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          active={editor?.isActive('blockquote')}
          disabled={!editor}
          title="引用"
        >
          <Quote size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => {
            if (!editor) return
            const prev = editor.getAttributes('link').href as string | undefined
            const href = window.prompt('リンク先URLを入力', prev ?? 'https://')
            if (href === null) return
            if (href === '') {
              editor.chain().focus().unsetLink().run()
            } else {
              editor.chain().focus().setLink({ href }).run()
            }
          }}
          active={editor?.isActive('link')}
          disabled={!editor}
          title="リンク"
        >
          <Link2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={!editor}
          title="区切り線"
        >
          <Minus size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor || !editor.can().undo()}
          title="元に戻す (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor || !editor.can().redo()}
          title="やり直し (Ctrl+Shift+Z)"
        >
          <Redo2 size={15} />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:leading-normal prose-li:my-0 px-4 py-3 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[400px]"
      />
    </div>
  )
}
