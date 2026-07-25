'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Mark, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading3,
  Link2,
  Eraser,
} from 'lucide-react';
import { toRichHtml, isRichTextEmpty } from '../../lib/rich-text';
import './rich-text-field.css';

/** Minimal underline mark (StarterKit doesn't ship one). */
const UnderlineMark = Mark.create({
  name: 'underline',
  parseHTML() {
    return [{ tag: 'u' }, { style: 'text-decoration', getAttrs: (v) => String(v).includes('underline') && null }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['u', mergeAttributes(HTMLAttributes), 0];
  },
  addKeyboardShortcuts() {
    return { 'Mod-u': () => this.editor.commands.toggleMark('underline') };
  },
});

interface RichTextFieldProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Extra classes for the outer bordered container (e.g. EN highlight). */
  className?: string;
  minRows?: number;
  ariaLabel?: string;
}

function BubbleBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      data-active={active ? 'true' : 'false'}
      className="rtf-bubble-btn"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function RichTextField({
  value,
  onChange,
  placeholder,
  className = '',
  minRows = 4,
  ariaLabel,
}: RichTextFieldProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3, 4] },
        // Keep the toolbar surface small: drop rules we don't expose.
        horizontalRule: false,
        codeBlock: false,
        // StarterKit v3 ships Link + Underline; disable them so our own
        // configured versions below don't register duplicate extension names.
        link: false,
        underline: false,
      }),
      UnderlineMark,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Escreve aqui…' }),
    ],
    content: toRichHtml(value),
    editorProps: {
      attributes: {
        class: 'rtf-content',
        spellcheck: 'true',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(isRichTextEmpty(html) ? '' : html);
    },
  });

  // Sync external changes (e.g. the "Traduzir EN" button fills the value)
  // without clobbering what the user is actively typing.
  useEffect(() => {
    if (!editor) return;
    const incoming = toRichHtml(value);
    const current = editor.getHTML();
    const bothEmpty = isRichTextEmpty(incoming) && isRichTextEmpty(current);
    if (!bothEmpty && incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL do link:', prev ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div
      className={`rtf-shell relative rounded-xl border bg-white transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 ${className}`}
    >
      {editor && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor, from, to }) => editor.isEditable && from !== to}
          options={{ placement: 'top' }}
          style={{ zIndex: 200 }}
        >
          <div className="rtf-bubble" role="toolbar" aria-label="Formatação">
            <BubbleBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito (⌘B)"><Bold size={14} /></BubbleBtn>
            <BubbleBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico (⌘I)"><Italic size={14} /></BubbleBtn>
            <BubbleBtn onClick={() => editor.chain().focus().toggleMark('underline').run()} active={editor.isActive('underline')} title="Sublinhado (⌘U)"><UnderlineIcon size={14} /></BubbleBtn>
            <BubbleBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Riscado"><Strikethrough size={14} /></BubbleBtn>
            <span className="rtf-bubble-sep" />
            <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Subtítulo"><Heading3 size={14} /></BubbleBtn>
            <BubbleBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista"><List size={14} /></BubbleBtn>
            <BubbleBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada"><ListOrdered size={14} /></BubbleBtn>
            <BubbleBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citação"><Quote size={14} /></BubbleBtn>
            <span className="rtf-bubble-sep" />
            <BubbleBtn onClick={setLink} active={editor.isActive('link')} title="Link"><Link2 size={14} /></BubbleBtn>
            <BubbleBtn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Limpar formatação"><Eraser size={14} /></BubbleBtn>
          </div>
        </BubbleMenu>
      )}
      <EditorContent
        editor={editor}
        className="px-3 py-2.5"
        style={{ minHeight: `${minRows * 1.6}rem` }}
      />
    </div>
  );
}
