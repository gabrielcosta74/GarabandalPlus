"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { NodeSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Extension, Mark, Node as TiptapNode, mergeAttributes, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Youtube } from '@tiptap/extension-youtube';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Code,
  Columns2,
  Copy,
  GripVertical,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Pilcrow,
  Plus,
  Quote,
  Settings2,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import '../../content/article-prose.css';
import './editor.css';

export type EditorHandle = {
  getHtml: () => string;
  getJson: () => unknown;
  focus: () => void;
};

type Props = {
  initialHtml: string;
  placeholder?: string;
  onChange?: (html: string) => void;
};

type UploadState = { count: number; total: number } | null;
type PickerState = { x: number; y: number; pos: number; source: 'plus' | 'slash' } | null;
type HoverBlock = { top: number; left: number; width: number; height: number; pos: number } | null;
type BlockBox = { top: number; left: number; width: number; height: number; pos: number; label: string } | null;
type SelectedImage = { pos: number; top: number; left: number; width: number; height: number; attrWidth: number | null } | null;

type BlockCategory = 'Texto' | 'Media' | 'Layout' | 'Editorial' | 'Templates';
type BlockDefinition = {
  key: string;
  label: string;
  description: string;
  category: BlockCategory;
  icon: typeof Pilcrow;
  html: string;
};

const UnderlineMark = Mark.create({
  name: 'underline',
  parseHTML() {
    return [{ tag: 'u' }, { style: 'text-decoration', getAttrs: (value) => String(value).includes('underline') && null }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['u', mergeAttributes(HTMLAttributes), 0];
  },
  addKeyboardShortcuts() {
    return {
      'Mod-u': () => this.editor.commands.toggleMark('underline'),
    };
  },
});

const HighlightMark = Mark.create({
  name: 'highlight',
  parseHTML() {
    return [{ tag: 'mark' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0];
  },
});

type TextAlignValue = 'left' | 'center' | 'right' | 'justify';
const ALIGN_TYPES = ['paragraph', 'heading'];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cmsTextAlign: {
      setTextAlign: (alignment: TextAlignValue) => ReturnType;
    };
  }
}

// Alignment is stored as a `cms-align-*` class (not inline style) so it
// survives the server-side sanitizer, which strips the `style` attribute.
const CmsTextAlign = Extension.create({
  name: 'cmsTextAlign',
  addGlobalAttributes() {
    return [
      {
        types: ALIGN_TYPES,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.getAttribute('class')?.match(/cms-align-(left|center|right|justify)/)?.[1] ?? null,
            renderHTML: (attributes) => {
              const align = attributes.textAlign as TextAlignValue | null;
              if (!align || align === 'left') return {};
              return { class: `cms-align-${align}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setTextAlign: (alignment) => ({ commands }) =>
        ALIGN_TYPES.map((type) => commands.updateAttributes(type, { textAlign: alignment })).some(Boolean),
    };
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-l': () => this.editor.commands.setTextAlign('left'),
      'Mod-Shift-e': () => this.editor.commands.setTextAlign('center'),
      'Mod-Shift-r': () => this.editor.commands.setTextAlign('right'),
      'Mod-Shift-j': () => this.editor.commands.setTextAlign('justify'),
    };
  },
});

// Preserve the cms-todo marker on bullet lists so the checklist block keeps its
// styling — StarterKit's bulletList drops unknown attributes on parse otherwise.
const CmsListAttrs = Extension.create({
  name: 'cmsListAttrs',
  addGlobalAttributes() {
    return [
      {
        types: ['bulletList'],
        attributes: {
          class: {
            default: null,
            parseHTML: (element) => (element.getAttribute('class')?.includes('cms-todo') ? 'cms-todo' : null),
            renderHTML: (attributes) => (attributes.class ? { class: attributes.class } : {}),
          },
          'data-cms-block': {
            default: null,
            parseHTML: (element) => (element.getAttribute('data-cms-block') === 'todo' ? 'todo' : null),
            renderHTML: (attributes) => (attributes['data-cms-block'] ? { 'data-cms-block': attributes['data-cms-block'] } : {}),
          },
        },
      },
    ];
  },
});

const CmsSection = TiptapNode.create({
  name: 'cmsSection',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      class: { default: 'cms-section' },
      'data-cms-block': { default: 'section' },
      'data-variant': { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-cms-block="section"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

const CmsCallout = TiptapNode.create({
  name: 'cmsCallout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      class: { default: 'cms-callout' },
      'data-cms-block': { default: 'callout' },
      'data-variant': { default: 'info' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-cms-block="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

const CmsColumns = TiptapNode.create({
  name: 'cmsColumns',
  group: 'block',
  content: 'cmsColumn{2,4}',
  defining: true,
  addAttributes() {
    return {
      class: { default: 'cms-columns' },
      'data-cms-block': { default: 'columns' },
      'data-columns': { default: '2' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-cms-block="columns"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

const CmsColumn = TiptapNode.create({
  name: 'cmsColumn',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return {
      class: { default: 'cms-column' },
    };
  },
  parseHTML() {
    return [{ tag: 'div.cms-column' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

const CmsGallery = TiptapNode.create({
  name: 'cmsGallery',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      class: { default: 'cms-gallery' },
      'data-cms-block': { default: 'gallery' },
      'data-columns': { default: '3' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-cms-block="gallery"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

const CmsEmbed = TiptapNode.create({
  name: 'cmsEmbed',
  group: 'block',
  content: 'block*',
  defining: true,
  addAttributes() {
    return {
      class: { default: 'cms-embed' },
      'data-cms-block': { default: 'embed' },
      'data-ratio': { default: '16-9' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-cms-block="embed"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

const CmsDivider = TiptapNode.create({
  name: 'cmsDivider',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      class: { default: 'cms-divider' },
      'data-cms-block': { default: 'divider' },
      'data-variant': { default: 'gold' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-cms-block="divider"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)];
  },
});

// Generic embed iframe (Vimeo, SoundCloud, gloria.tv...). The Youtube extension
// only parses `div[data-youtube-video] iframe`, so a bare iframe needs its own
// node or it would be dropped on parse. Lower priority so Youtube keeps legacy
// content. Host whitelist is enforced server-side by the sanitizer.
const CmsIframe = TiptapNode.create({
  name: 'cmsIframe',
  group: 'block',
  atom: true,
  selectable: true,
  priority: 50,
  addAttributes() {
    return {
      src: { default: null },
      loading: { default: 'lazy' },
      allowfullscreen: { default: 'true' },
      frameborder: { default: '0' },
    };
  },
  parseHTML() {
    return [{ tag: 'iframe' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['iframe', mergeAttributes(HTMLAttributes)];
  },
});

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('width'),
        renderHTML: (attributes) => attributes.width ? { width: attributes.width } : {},
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute('height'),
        renderHTML: (attributes) => attributes.height ? { height: attributes.height } : {},
      },
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute('class'),
        renderHTML: (attributes) => attributes.class ? { class: attributes.class } : {},
      },
      'data-align': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-align'),
        renderHTML: (attributes) => attributes['data-align'] ? { 'data-align': attributes['data-align'] } : {},
      },
    };
  },
});

// Editable caption inside a <figure>. Plain text only (no marks) so it always
// renders as a clean <figcaption> that the sanitizer already allows.
const Figcaption = TiptapNode.create({
  name: 'figcaption',
  content: 'inline*',
  marks: '',
  selectable: false,
  parseHTML() {
    return [{ tag: 'figcaption' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['figcaption', mergeAttributes(HTMLAttributes, { class: 'cms-figcaption' }), 0];
  },
});

// A figure wraps an image + its caption so captions are semantically tied to
// the image (instead of a loose <p><em>). The inner image keeps all its
// existing selection/resize/align tooling because it is still an `image` node.
const CmsFigure = TiptapNode.create({
  name: 'cmsFigure',
  group: 'block',
  // Caption optional so figures pasted/migrated without one (and bare image
  // figures) still parse cleanly.
  content: 'image figcaption?',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      class: { default: 'cms-figure' },
      'data-cms-block': { default: 'figure' },
      'data-align': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-align'),
        renderHTML: (attributes) => (attributes['data-align'] ? { 'data-align': attributes['data-align'] } : {}),
      },
    };
  },
  // Match ANY <figure> (including legacy figure.cms-image from migrated content)
  // so existing captions survive a round-trip through the editor.
  parseHTML() {
    return [{ tag: 'figure' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes), 0];
  },
});

const BLOCKS: BlockDefinition[] = [
  { key: 'section-text', label: 'Secao de texto', description: 'Titulo, subtitulo e paragrafo prontos a editar.', category: 'Templates', icon: Pilcrow, html: '<div class="cms-section" data-cms-block="section"><h2>Nova secao</h2><p>Escreve o conteudo desta secao aqui.</p></div>' },
  { key: 'section-image-text', label: 'Imagem + texto', description: 'Layout editorial de duas colunas.', category: 'Templates', icon: Columns2, html: '<div class="cms-columns" data-cms-block="columns" data-columns="2"><div class="cms-column"><p></p></div><div class="cms-column"><h3>Título da secção</h3><p>Texto de apoio ao lado da imagem.</p></div></div>' },
  { key: 'paragraph', label: 'Paragrafo', description: 'Texto corrido com marcas inline.', category: 'Texto', icon: Pilcrow, html: '<p>Novo paragrafo.</p>' },
  { key: 'h2', label: 'Titulo H2', description: 'Titulo principal de secao.', category: 'Texto', icon: Pilcrow, html: '<h2>Novo titulo</h2>' },
  { key: 'h3', label: 'Titulo H3', description: 'Subtitulo dentro de uma secao.', category: 'Texto', icon: Pilcrow, html: '<h3>Novo subtitulo</h3>' },
  { key: 'callout-info', label: 'Callout info', description: 'Caixa azul para notas importantes.', category: 'Editorial', icon: Quote, html: '<div class="cms-callout" data-cms-block="callout" data-variant="info"><p><strong>Info.</strong> Escreve a nota aqui.</p></div>' },
  { key: 'callout-success', label: 'Callout sucesso', description: 'Caixa verde para mensagens positivas.', category: 'Editorial', icon: Quote, html: '<div class="cms-callout" data-cms-block="callout" data-variant="success"><p><strong>Sucesso.</strong> Escreve a nota aqui.</p></div>' },
  { key: 'callout-warning', label: 'Callout aviso', description: 'Caixa dourada para avisos.', category: 'Editorial', icon: Quote, html: '<div class="cms-callout" data-cms-block="callout" data-variant="warning"><p><strong>Aviso.</strong> Escreve a nota aqui.</p></div>' },
  { key: 'quote', label: 'Citacao', description: 'Bloco de citacao editorial.', category: 'Editorial', icon: Quote, html: '<blockquote><p>Cita a passagem aqui.</p></blockquote>' },
  { key: 'image', label: 'Imagem', description: 'Faz upload ou arrasta uma imagem.', category: 'Media', icon: ImageIcon, html: '' },
  { key: 'gallery', label: 'Galeria 3 colunas', description: 'Area preparada para 2-4 imagens.', category: 'Media', icon: ImageIcon, html: '<div class="cms-gallery" data-cms-block="gallery" data-columns="3"><p></p></div>' },
  { key: 'video', label: 'Video', description: 'YouTube, Vimeo ou iframe permitido.', category: 'Media', icon: ImageIcon, html: '' },
  { key: 'columns-2', label: 'Duas colunas', description: 'Layout 50/50 para conteudo lado a lado.', category: 'Layout', icon: Columns2, html: '<div class="cms-columns" data-cms-block="columns" data-columns="2"><div class="cms-column"><p></p></div><div class="cms-column"><p></p></div></div>' },
  { key: 'bullet', label: 'Lista', description: 'Lista com pontos.', category: 'Texto', icon: List, html: '<ul><li><p>Item</p></li></ul>' },
  { key: 'ordered', label: 'Lista numerada', description: 'Lista ordenada.', category: 'Texto', icon: ListOrdered, html: '<ol><li><p>Item</p></li></ol>' },
  { key: 'todo', label: 'Checklist', description: 'Lista de tarefas publicavel.', category: 'Texto', icon: List, html: '<ul class="cms-todo" data-cms-block="todo"><li><p>Tarefa</p></li></ul>' },
  { key: 'table', label: 'Tabela', description: 'Tabela 3x3 editavel.', category: 'Editorial', icon: Settings2, html: '' },
  { key: 'code', label: 'Codigo', description: 'Bloco monoespacado.', category: 'Editorial', icon: Code, html: '<pre><code>// codigo</code></pre>' },
  { key: 'divider', label: 'Divisor dourado', description: 'Separador visual entre secoes.', category: 'Editorial', icon: Minus, html: '<div class="cms-divider" data-cms-block="divider" data-variant="gold"></div>' },
];

// Each block maps to a small illustrated thumbnail variant shown in the picker.
type ThumbVariant = 'heading' | 'text' | 'section' | 'image' | 'gallery' | 'columns' | 'callout' | 'quote' | 'divider' | 'table' | 'code' | 'video' | 'list' | 'todo';
const BLOCK_THUMB: Record<string, ThumbVariant> = {
  'section-text': 'section', 'section-image-text': 'columns',
  paragraph: 'text', h2: 'heading', h3: 'heading',
  'callout-info': 'callout', 'callout-success': 'callout', 'callout-warning': 'callout',
  quote: 'quote', image: 'image', gallery: 'gallery', video: 'video',
  'columns-2': 'columns', bullet: 'list', ordered: 'list', todo: 'todo',
  table: 'table', code: 'code', divider: 'divider',
};

const RECENT_BLOCKS_KEY = 'cms-recent-blocks';
function getRecentBlocks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(RECENT_BLOCKS_KEY) ?? '[]');
    return Array.isArray(raw) ? (raw as string[]).filter((k) => BLOCKS.some((b) => b.key === k)) : [];
  } catch {
    return [];
  }
}
function pushRecentBlock(key: string) {
  if (typeof window === 'undefined') return;
  const next = [key, ...getRecentBlocks().filter((k) => k !== key)].slice(0, 5);
  try {
    window.localStorage.setItem(RECENT_BLOCKS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

// Tiny CSS-drawn preview of what each block produces. Pure presentation.
function BlockThumb({ variant }: { variant: ThumbVariant }) {
  return (
    <span className={`cms-thumb cms-thumb-${variant}`} aria-hidden>
      {variant === 'image' && <ImageIcon size={20} />}
      {variant === 'video' && <span className="cms-thumb-play" />}
      {variant === 'quote' && <span className="cms-thumb-quote">&ldquo;</span>}
      {variant === 'gallery' && <><i /><i /><i /></>}
      {variant === 'columns' && <><i /><i /></>}
      {variant === 'table' && <><i /><i /><i /><i /></>}
      {(variant === 'heading' || variant === 'text' || variant === 'section' || variant === 'callout' || variant === 'list' || variant === 'todo' || variant === 'code') && (
        <><i /><i /><i /></>
      )}
    </span>
  );
}

export const TipTapEditor = forwardRef<EditorHandle, Props>(function TipTapEditor(
  { initialHtml, placeholder = 'Escreve aqui...', onChange },
  ref,
) {
  const [uploadState, setUploadState] = useState<UploadState>(null);
  const [picker, setPicker] = useState<PickerState>(null);
  const [hoverBlock, setHoverBlock] = useState<HoverBlock>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockBox>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [linkPopover, setLinkPopover] = useState<{ top: number; left: number; value: string } | null>(null);
  const [prompt, setPrompt] = useState<{ top: number; left: number; title: string; placeholder: string; value: string; apply: (v: string) => void } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropLine, setDropLine] = useState<{ top: number; left: number; width: number } | null>(null);
  const [menu, setMenu] = useState<{ pos: number; top: number; left: number; label: string } | null>(null);
  const dragRef = useRef<{ fromIndex: number; dropIndex: number } | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const hoverPosRef = useRef<number | null>(null);
  const replaceImagePos = useRef<number | null>(null);
  const pendingImageInsertPos = useRef<number | null>(null);
  const insertButtonRef = useRef<HTMLButtonElement>(null);
  const hideControlsTimer = useRef<number | null>(null);

  const cancelHideControls = useCallback(() => {
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = null;
  }, []);

  const scheduleHideControls = useCallback(() => {
    cancelHideControls();
    hideControlsTimer.current = window.setTimeout(() => {
      setHoverBlock(null);
      hideControlsTimer.current = null;
    }, 350);
  }, [cancelHideControls]);

  const onUploadImage = useCallback(async (file: File): Promise<string | null> => {
    if (!supabaseBrowser) return null;
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session?.access_token) {
      window.alert('Sessao expirada. Volta a entrar.');
      return null;
    }
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/cms/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(`Upload falhou: ${err.error ?? res.statusText}`);
      return null;
    }
    const { url } = await res.json();
    return url as string;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      CmsSection,
      CmsCallout,
      CmsColumns,
      CmsColumn,
      CmsGallery,
      CmsEmbed,
      CmsDivider,
      CmsIframe,
      CmsFigure,
      Figcaption,
      UnderlineMark,
      HighlightMark,
      CmsTextAlign,
      CmsListAttrs,
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node, pos, editor }) => {
          const name = node.type.name;
          if (name === 'figcaption') return 'Escreve uma legenda (opcional)…';
          if (name !== 'paragraph') return '';
          try {
            const parent = editor.state.doc.resolve(pos).parent;
            const p = parent?.type.name;
            if (p === 'cmsColumn') return 'Escreve ou arrasta uma imagem…';
            if (p === 'cmsGallery') return 'Arrasta imagens para aqui ou usa /imagem';
            if (p === 'cmsCallout') return 'Escreve a tua nota…';
          } catch { /* position not resolvable yet */ }
          return placeholder;
        },
      }),
      CharacterCount,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ controls: true, nocookie: true, modestBranding: true }),
    ],
    content: initialHtml || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'article-prose cms-tiptap',
        spellcheck: 'true',
      },
      handleDOMEvents: {
        mousemove: (view, event) => {
          // Block hover controls must not compete with the text-selection
          // bubble menu, so skip them entirely while a selection is active.
          if (!view.state.selection.empty) {
            if (hoverPosRef.current !== null) { hoverPosRef.current = null; setHoverBlock(null); }
            return false;
          }
          const target = event.target as HTMLElement | null;
          const block = target?.closest('.cms-tiptap > *') as HTMLElement | null;
          if (!block) {
            scheduleHideControls();
            return false;
          }
          cancelHideControls();
          const rect = block.getBoundingClientRect();
          const pos = view.posAtCoords({ left: rect.left + 8, top: rect.top + 8 })?.pos;
          if (pos == null) return false;
          // Only re-render when the hovered block actually changes — otherwise
          // every mouse move would re-render and destabilise the bubble menu.
          if (hoverPosRef.current === pos) return false;
          hoverPosRef.current = pos;
          setHoverBlock({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, pos });
          return false;
        },
        mousedown: (view, event) => {
          const target = event.target as HTMLElement | null;
          const block = target?.closest('.cms-tiptap > *') as HTMLElement | null;
          if (!block) return false;
          const rect = block.getBoundingClientRect();
          const pos = view.posAtCoords({ left: rect.left + 8, top: rect.top + 8 })?.pos;
          if (pos == null) return false;
          setSelectedBlock({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, pos, label: blockLabel(block) });
          cancelHideControls();
          return false;
        },
        mouseleave: () => {
          scheduleHideControls();
          return false;
        },
      },
      handleClickOn(_view, pos, node) {
        if (node.type.name !== 'image') return false;
        replaceImagePos.current = pos;
        _view.dispatch(_view.state.tr.setSelection(NodeSelection.create(_view.state.doc, pos)));
        _view.focus();
        return true;
      },
      handleTextInput(view, from, to, text) {
        if (text !== '/') return false;
        const coords = view.coordsAtPos(from);
        window.setTimeout(() => setPicker({ x: coords.left, y: coords.bottom + 8, pos: from, source: 'slash' }), 0);
        return false;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        void uploadAndInsert(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null);
        return true;
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        void uploadAndInsert(files, null);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  const syncSelectedImage = useCallback(() => {
    if (!editor) return;
    const { selection } = editor.state;
    if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') {
      setSelectedImage(null);
      return;
    }
    const dom = editor.view.nodeDOM(selection.from) as HTMLElement | null;
    if (!dom) {
      setSelectedImage(null);
      return;
    }
    const rect = dom.getBoundingClientRect();
    const attrWidth = Number(selection.node.attrs.width) || null;
    setSelectedImage({
      pos: selection.from,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      attrWidth,
    });
  }, [editor]);

  const syncSelectedBlock = useCallback(() => {
    if (!editor || !selectedBlock) return;
    const range = blockRange(editor, selectedBlock.pos);
    if (!range) return;
    const dom = editor.view.nodeDOM(range.from) as HTMLElement | null;
    if (!dom) return;
    const block = dom.matches?.('.cms-tiptap > *') ? dom : dom.closest?.('.cms-tiptap > *') as HTMLElement | null;
    if (!block) return;
    const rect = block.getBoundingClientRect();
    setSelectedBlock((current) => current ? {
      ...current,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      label: blockLabel(block),
    } : null);
  }, [editor, selectedBlock]);

  useEffect(() => {
    if (!editor) return;
    editor.on('selectionUpdate', syncSelectedImage);
    editor.on('transaction', syncSelectedImage);
    window.addEventListener('resize', syncSelectedImage);
    window.addEventListener('scroll', syncSelectedImage, true);
    syncSelectedImage();
    return () => {
      editor.off('selectionUpdate', syncSelectedImage);
      editor.off('transaction', syncSelectedImage);
      window.removeEventListener('resize', syncSelectedImage);
      window.removeEventListener('scroll', syncSelectedImage, true);
    };
  }, [editor, syncSelectedImage]);

  useEffect(() => {
    window.addEventListener('resize', syncSelectedBlock);
    window.addEventListener('scroll', syncSelectedBlock, true);
    return () => {
      window.removeEventListener('resize', syncSelectedBlock);
      window.removeEventListener('scroll', syncSelectedBlock, true);
    };
  }, [syncSelectedBlock]);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const active = !editor.state.selection.empty;
      setHasSelection(active);
      // A live text selection takes over: drop any pinned/hovered block tools
      // so they can't sit on top of the formatting bubble menu.
      if (active) { setSelectedBlock(null); setHoverBlock(null); hoverPosRef.current = null; }
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => { editor.off('selectionUpdate', update); editor.off('transaction', update); };
  }, [editor]);

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    };
  }, []);

  const uploadAndInsert = useCallback(
    async (files: File[], pos: number | null) => {
      if (!editor) return;
      setUploadState({ count: 0, total: files.length });
      let inserted = 0;
      for (const file of files) {
        const url = await onUploadImage(file);
        inserted++;
        setUploadState({ count: inserted, total: files.length });
        if (!url) continue;
        const alt = file.name.replace(/\.[^.]+$/, '');
        const attrs = { src: url, alt, class: 'cms-image', 'data-align': 'center' };
        if (pos != null) {
          editor.chain().focus().insertContentAt(pos, { type: 'image', attrs }).run();
        } else {
          editor.chain().focus().setImage(attrs).run();
        }
      }
      setUploadState(null);
    },
    [editor, onUploadImage],
  );

  const replaceSelectedImage = async (file: File | undefined) => {
    if (!editor || !file || replaceImagePos.current == null) return;
    const url = await onUploadImage(file);
    if (!url) return;
    editor.chain().focus().setNodeSelection(replaceImagePos.current).updateAttributes('image', {
      src: url,
      alt: file.name.replace(/\.[^.]+$/, ''),
      class: 'cms-image',
    }).run();
    replaceImagePos.current = null;
  };

  const setImageWidth = useCallback((width: number | null) => {
    if (!editor || !selectedImage) return;
    const attrs = width ? { width: String(Math.round(width)), height: null } : { width: null, height: null };
    editor.chain().focus().setNodeSelection(selectedImage.pos).updateAttributes('image', attrs).run();
    window.setTimeout(syncSelectedImage, 0);
  }, [editor, selectedImage, syncSelectedImage]);

  const setImageAlign = useCallback((align: 'left' | 'center' | 'right' | 'wide') => {
    if (!editor || !selectedImage) return;
    editor.chain().focus().setNodeSelection(selectedImage.pos).updateAttributes('image', {
      class: 'cms-image',
      'data-align': align,
    }).run();
    window.setTimeout(syncSelectedImage, 0);
  }, [editor, selectedImage, syncSelectedImage]);

  const startImageResize = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!editor || !selectedImage) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = selectedImage.width;
    const maxWidth = 980;
    const minWidth = 160;

    const onMove = (moveEvent: MouseEvent) => {
      const next = Math.max(minWidth, Math.min(maxWidth, startWidth + (moveEvent.clientX - startX)));
      editor.chain().focus().setNodeSelection(selectedImage.pos).updateAttributes('image', { width: String(Math.round(next)), height: null }).run();
      window.setTimeout(syncSelectedImage, 0);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [editor, selectedImage, syncSelectedImage]);

  useEffect(() => {
    if (!editor) return;
    if (initialHtml && editor.getHTML() === '<p></p>') {
      editor.commands.setContent(initialHtml, { emitUpdate: false });
    }
  }, [editor, initialHtml]);

  useImperativeHandle(ref, () => ({
    getHtml: () => editor?.getHTML() ?? '',
    getJson: () => editor?.getJSON() ?? null,
    focus: () => editor?.commands.focus(),
  }), [editor]);

  // Briefly highlight the block at `pos` so a freshly inserted component is easy
  // to spot (a soft gold glow that fades out).
  const flashBlockAt = useCallback((pos: number) => {
    if (!editor) return;
    requestAnimationFrame(() => {
      try {
        const at = Math.min(Math.max(pos, 0), editor.state.doc.content.size);
        const dom = editor.view.domAtPos(at);
        let el: Node | null = dom?.node ?? null;
        if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
        const block = (el as HTMLElement | null)?.closest?.('.cms-tiptap > *') as HTMLElement | null;
        if (block) {
          block.classList.add('cms-flash');
          window.setTimeout(() => block.classList.remove('cms-flash'), 900);
        }
      } catch { /* best-effort visual only */ }
    });
  }, [editor]);

  // Open an inline text popover anchored near a document position. Replaces the
  // old window.prompt() calls (alt text, caption, embed URL) with accessible UI.
  const openPromptAt = useCallback(
    (pos: number, opts: { title: string; placeholder: string; value?: string; apply: (v: string) => void }) => {
      if (!editor) return;
      const coords = editor.view.coordsAtPos(Math.min(pos, editor.state.doc.content.size));
      setPrompt({ top: coords.bottom + 8, left: coords.left, title: opts.title, placeholder: opts.placeholder, value: opts.value ?? '', apply: opts.apply });
    },
    [editor],
  );

  const insertBlock = useCallback((kind: string, pos: number) => {
    if (!editor) return;
    const insertAt = picker?.source === 'slash' ? { from: pos, to: pos + 1 } : pos;
    const chain = editor.chain().focus();
    if (kind === 'image') {
      if (picker?.source === 'slash') editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();
      pendingImageInsertPos.current = pos;
      replaceImagePos.current = null;
      replaceInputRef.current?.click();
    } else if (kind === 'video') {
      const at = insertAt;
      const anchor = typeof at === 'number' ? at : at.from;
      openPromptAt(anchor, {
        title: 'Inserir vídeo',
        placeholder: 'Cola o link do YouTube ou Vimeo',
        apply: (raw) => {
          const embed = toEmbedUrl(raw.trim());
          if (!embed) { window.alert('Não reconheci o link. Usa um endereço do YouTube ou Vimeo.'); return; }
          editor.chain().focus().insertContentAt(at, `<div class="cms-embed" data-cms-block="embed" data-ratio="16-9"><iframe src="${escapeHtml(embed)}" loading="lazy" allowfullscreen></iframe></div>`).run();
          flashBlockAt(anchor);
        },
      });
    } else if (kind === 'table') {
      const at = editor.state.selection.from;
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      flashBlockAt(at);
    } else {
      const block = BLOCKS.find((item) => item.key === kind);
      if (block?.html) {
        chain.insertContentAt(insertAt, block.html).run();
        flashBlockAt(typeof insertAt === 'number' ? insertAt : insertAt.from);
      }
    }
    setPicker(null);
  }, [editor, picker, openPromptAt, flashBlockAt]);

  const openLinkPopover = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const coords = editor.view.coordsAtPos(Math.min(from, to));
    setLinkPopover({
      top: coords.bottom + 8,
      left: coords.left,
      value: (editor.getAttributes('link').href as string) ?? '',
    });
  }, [editor]);

  const applyLink = useCallback((rawUrl: string) => {
    if (!editor) return;
    const url = rawUrl.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!url) chain.unsetLink().run();
    else chain.setLink({ href: url, target: url.startsWith('http') ? '_blank' : null }).run();
    setLinkPopover(null);
  }, [editor]);

  const openPickerFromButton = useCallback((pos: number) => {
    const rect = insertButtonRef.current?.getBoundingClientRect();
    setPicker({
      x: rect ? rect.left : window.innerWidth / 2 - 160,
      y: rect ? rect.bottom + 8 : 140,
      pos,
      source: 'plus',
    });
  }, []);

  // Wrap the image at `imgPos` in a <figure> with a <figcaption>, or update the
  // caption if it's already a figure. An empty caption unwraps back to a plain
  // image so we never leave empty figures behind.
  const applyImageCaption = useCallback(
    (imgPos: number, caption: string) => {
      if (!editor) return;
      const imgNode = editor.state.doc.nodeAt(imgPos);
      if (!imgNode || imgNode.type.name !== 'image') return;
      const $pos = editor.state.doc.resolve(imgPos);
      const inFigure = $pos.depth >= 1 && $pos.parent.type.name === 'cmsFigure';
      const trimmed = caption.trim();
      const figureContent = [
        imgNode.toJSON() as JSONContent,
        { type: 'figcaption', content: trimmed ? [{ type: 'text', text: trimmed }] : [] },
      ];
      if (inFigure) {
        const from = $pos.before($pos.depth);
        const to = $pos.after($pos.depth);
        if (!trimmed) {
          editor.chain().focus().insertContentAt({ from, to }, imgNode.toJSON() as JSONContent).run();
        } else {
          editor.chain().focus().insertContentAt({ from, to }, { type: 'cmsFigure', content: figureContent }).run();
        }
      } else {
        editor.chain().focus().insertContentAt({ from: imgPos, to: imgPos + imgNode.nodeSize }, { type: 'cmsFigure', content: figureContent }).run();
      }
    },
    [editor],
  );

  const endBlockDrag = useCallback(() => {
    setDragging(false);
    setDropLine(null);
    document.body.style.cursor = '';
    const info = dragRef.current;
    dragRef.current = null;
    if (editor && info && info.dropIndex >= 0) moveBlockToIndex(editor, info.fromIndex, info.dropIndex);
  }, [editor]);

  const onDragMove = useCallback((event: MouseEvent) => {
    if (!editor) return;
    const children = Array.from(editor.view.dom.children) as HTMLElement[];
    if (children.length === 0) return;
    let dropIndex = children.length;
    for (let i = 0; i < children.length; i++) {
      const r = children[i].getBoundingClientRect();
      if (event.clientY < r.top + r.height / 2) { dropIndex = i; break; }
    }
    const ref = children[Math.min(dropIndex, children.length - 1)].getBoundingClientRect();
    setDropLine({ top: dropIndex < children.length ? ref.top - 2 : ref.bottom + 2, left: ref.left, width: ref.width });
    if (dragRef.current) dragRef.current.dropIndex = dropIndex;
  }, [editor]);

  const startBlockDrag = useCallback(
    (event: React.MouseEvent, blockPos: number) => {
      if (!editor) return;
      event.preventDefault();
      const blocks = topLevelBlocks(editor);
      const fromIndex = blocks.findIndex((b) => blockPos >= b.from && blockPos < b.to);
      if (fromIndex < 0) return;
      dragRef.current = { fromIndex, dropIndex: -1 };
      setDragging(true);
      setSelectedBlock(null);
      setHoverBlock(null);
      document.body.style.cursor = 'grabbing';
      const onUp = () => {
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onUp);
        endBlockDrag();
      };
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('mouseup', onUp);
    },
    [editor, onDragMove, endBlockDrag],
  );

  if (!editor) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
        A carregar editor...
      </div>
    );
  }

  const chars = editor.storage.characterCount?.characters?.() ?? 0;
  const words = editor.storage.characterCount?.words?.() ?? 0;
  const activeBlock = hasSelection ? null : (selectedBlock ?? (hoverBlock ? { ...hoverBlock, label: 'Bloco' } : null));
  const alignActive = editor.isActive({ textAlign: 'center' }) || editor.isActive({ textAlign: 'right' }) || editor.isActive({ textAlign: 'justify' });

  return (
    <div className="cms-editor-shell">
      <div className="cms-insert-strip">
        <button
          ref={insertButtonRef}
          type="button"
          onClick={() => openPickerFromButton(editor.state.selection.to)}
          className="cms-insert-main"
        >
          <Plus size={16} /> Adicionar secao ou componente
        </button>
        <span>Tambem podes escrever / dentro do texto.</span>
      </div>

      <div className="cms-live-body">
        <EditorContent editor={editor} />
      </div>

      <BubbleMenu
        editor={editor}
        shouldShow={({ editor, from, to }) => {
          if (!editor.isEditable) return false;
          if (from === to) return false;
          if (editor.isActive('image') || editor.isActive('youtube')) return false;
          return true;
        }}
        options={{ placement: 'top' }}
        style={{ zIndex: 200 }}
      >
        <div className="cms-bubble-menu" role="toolbar" aria-label="Formatacao">
          <BubbleBtn action={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito"><Bold size={14} /></BubbleBtn>
          <BubbleBtn action={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italico"><Italic size={14} /></BubbleBtn>
          <BubbleBtn action={() => editor.chain().focus().toggleMark('underline').run()} active={editor.isActive('underline')} title="Sublinhado"><UnderlineIcon size={14} /></BubbleBtn>
          <BubbleBtn action={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Riscado"><Strikethrough size={14} /></BubbleBtn>
          <BubbleBtn action={() => editor.chain().focus().toggleMark('highlight').run()} active={editor.isActive('highlight')} title="Realce"><Highlighter size={14} /></BubbleBtn>
          <BubbleBtn action={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Codigo"><Code size={14} /></BubbleBtn>
          <span className="cms-bubble-sep" />
          <BubbleBtn action={() => editor.chain().focus().setTextAlign('left').run()} active={!alignActive} title="Alinhar a esquerda (Cmd/Ctrl+Shift+L)"><AlignLeft size={14} /></BubbleBtn>
          <BubbleBtn action={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centrar (Cmd/Ctrl+Shift+E)"><AlignCenter size={14} /></BubbleBtn>
          <BubbleBtn action={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinhar a direita (Cmd/Ctrl+Shift+R)"><AlignRight size={14} /></BubbleBtn>
          <BubbleBtn action={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificar (Cmd/Ctrl+Shift+J)"><AlignJustify size={14} /></BubbleBtn>
          <span className="cms-bubble-sep" />
          <BubbleBtn action={openLinkPopover} active={editor.isActive('link')} title="Link"><Link2 size={14} /></BubbleBtn>
        </div>
      </BubbleMenu>

      <BubbleMenu
        editor={editor}
        shouldShow={({ editor }) => editor.isEditable && editor.isActive('image')}
        options={{ placement: 'bottom' }}
        style={{ zIndex: 200 }}
      >
        <div className="cms-bubble-menu cms-bubble-image">
          <button type="button" className="cms-bubble-text-btn" onClick={() => {
            replaceImagePos.current = editor.state.selection.from;
            replaceInputRef.current?.click();
          }}>
            Substituir
          </button>
          <button
            type="button"
            className="cms-bubble-text-btn"
            onClick={() => {
              const pos = editor.state.selection.from;
              const current = (editor.getAttributes('image').alt as string) ?? '';
              openPromptAt(pos, { title: 'Texto alternativo (alt)', placeholder: 'Descreve a imagem para leitores de ecrã e SEO', value: current, apply: (alt) => editor.chain().focus().setNodeSelection(pos).updateAttributes('image', { alt }).run() });
            }}
          >
            Alt
          </button>
          <button type="button" className="cms-bubble-text-btn" onClick={() => {
            const pos = editor.state.selection.from;
            openPromptAt(pos, { title: 'Legenda', placeholder: 'Legenda da imagem', value: imageCaptionAt(editor, pos), apply: (c) => applyImageCaption(pos, c) });
          }}>
            Legenda
          </button>
          <button type="button" className="cms-bubble-text-btn cms-bubble-danger" onClick={() => editor.chain().focus().deleteSelection().run()}>
            Remover
          </button>
        </div>
      </BubbleMenu>

      {activeBlock && !dragging && (
        <>
          <div
            className="cms-block-gutter"
            style={{ top: activeBlock.top + 1, left: Math.max(6, activeBlock.left - 48) }}
            onMouseEnter={cancelHideControls}
            onMouseLeave={scheduleHideControls}
          >
            <button type="button" className="cms-gutter-btn cms-block-grip" title="Arrastar para mover" onMouseDown={(e) => startBlockDrag(e, activeBlock.pos)}>
              <GripVertical size={16} />
            </button>
            <button
              type="button"
              className="cms-gutter-btn"
              title="Opções do bloco"
              onClick={() => { setSelectedBlock(activeBlock); setMenu({ pos: activeBlock.pos, top: activeBlock.top, left: activeBlock.left, label: activeBlock.label }); }}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
          <button
            type="button"
            className="cms-insert-line"
            style={{ top: activeBlock.top + activeBlock.height + 1, left: activeBlock.left, width: activeBlock.width }}
            onClick={() => setPicker({ x: activeBlock.left, y: activeBlock.top + activeBlock.height + 18, pos: blockEndPos(editor, activeBlock.pos), source: 'plus' })}
            onMouseEnter={cancelHideControls}
            onMouseLeave={scheduleHideControls}
            title="Inserir secção aqui"
          >
            <span className="cms-insert-line-plus"><Plus size={14} /> Inserir aqui</span>
          </button>
        </>
      )}

      {menu && (
        <BlockMenu
          menu={menu}
          editor={editor}
          onClose={() => setMenu(null)}
        />
      )}

      {selectedImage && (
        <ImageControls
          image={selectedImage}
          onReplace={() => {
            replaceImagePos.current = selectedImage.pos;
            replaceInputRef.current?.click();
          }}
          onAlt={() => {
            const current = (editor.getAttributes('image').alt as string) ?? '';
            openPromptAt(selectedImage.pos, { title: 'Texto alternativo (alt)', placeholder: 'Descreve a imagem para leitores de ecrã e SEO', value: current, apply: (alt) => editor.chain().focus().setNodeSelection(selectedImage.pos).updateAttributes('image', { alt }).run() });
          }}
          onCaption={() => {
            openPromptAt(selectedImage.pos, { title: 'Legenda', placeholder: 'Legenda da imagem', value: imageCaptionAt(editor, selectedImage.pos), apply: (c) => applyImageCaption(selectedImage.pos, c) });
          }}
          onFullWidth={() => setImageWidth(null)}
          onWidth={setImageWidth}
          onAlign={setImageAlign}
          onMoveUp={() => moveBlock(editor, selectedImage.pos, 'up')}
          onMoveDown={() => moveBlock(editor, selectedImage.pos, 'down')}
          onResizeStart={startImageResize}
        />
      )}

      {picker && (
        <BlockPicker
          x={picker.x}
          y={picker.y}
          onMouseEnter={cancelHideControls}
          onMouseLeave={scheduleHideControls}
          onClose={() => setPicker(null)}
          onPick={(kind) => insertBlock(kind, picker.pos)}
        />
      )}

      {linkPopover && (
        <LinkPopover
          top={linkPopover.top}
          left={linkPopover.left}
          initialValue={linkPopover.value}
          onApply={applyLink}
          onClose={() => setLinkPopover(null)}
        />
      )}

      {prompt && (
        <PromptPopover
          top={prompt.top}
          left={prompt.left}
          title={prompt.title}
          placeholder={prompt.placeholder}
          initialValue={prompt.value}
          onApply={(v) => { prompt.apply(v); setPrompt(null); }}
          onClose={() => setPrompt(null)}
        />
      )}

      {dropLine && (
        <div className="cms-drop-line" style={{ top: dropLine.top, left: dropLine.left, width: dropLine.width }} />
      )}

      <div className="cms-insert-strip cms-insert-strip-bottom">
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setPicker({
              x: rect.left,
              y: Math.max(80, rect.top - 280),
              pos: editor.state.doc.content.size,
              source: 'plus',
            });
          }}
          className="cms-insert-main"
        >
          <Plus size={16} /> Adicionar no fim
        </button>
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (replaceImagePos.current == null && file) {
            void uploadAndInsert([file], pendingImageInsertPos.current);
            pendingImageInsertPos.current = null;
          } else {
            void replaceSelectedImage(file);
          }
        }}
      />

      <div className="cms-editor-statusbar">
        <span>{words} palavras · {chars} caracteres</span>
        {uploadState ? <span>A enviar {uploadState.count}/{uploadState.total}</span> : <span>~{Math.max(1, Math.round(words / 220))} min</span>}
      </div>
    </div>
  );
});

function BubbleBtn({
  action,
  active,
  title,
  children,
}: {
  action: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
      title={title}
      className={`cms-bubble-btn${active ? ' is-active' : ''}`}
    >
      {children}
    </button>
  );
}

function LinkPopover({
  top,
  left,
  initialValue,
  onApply,
  onClose,
}: {
  top: number;
  left: number;
  initialValue: string;
  onApply: (url: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div
      className="cms-link-popover"
      style={{ top, left: Math.min(left, window.innerWidth - 320) }}
      role="dialog"
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); onApply(value); }
          if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        }}
        placeholder="https://..."
        className="cms-link-popover-input"
      />
      <button type="button" className="cms-link-popover-apply" onClick={() => onApply(value)}>
        Aplicar
      </button>
      {initialValue && (
        <button type="button" className="cms-link-popover-remove" onClick={() => onApply('')} title="Remover link">
          <Link2 size={14} />
        </button>
      )}
    </div>
  );
}

function PromptPopover({
  top,
  left,
  title,
  placeholder,
  initialValue,
  onApply,
  onClose,
}: {
  top: number;
  left: number;
  title: string;
  placeholder: string;
  initialValue: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="cms-prompt-popover" style={{ top, left: Math.min(left, window.innerWidth - 340) }} role="dialog" aria-label={title}>
      <div className="cms-prompt-popover-title">{title}</div>
      <div className="cms-prompt-popover-row">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); onApply(value); }
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
          }}
          placeholder={placeholder}
          className="cms-prompt-popover-input"
        />
        <button type="button" className="cms-prompt-popover-apply" onClick={() => onApply(value)}>
          Aplicar
        </button>
      </div>
    </div>
  );
}

function BlockPicker({
  x,
  y,
  onClose,
  onPick,
  onMouseEnter,
  onMouseLeave,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onPick: (kind: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BlockCategory>('Templates');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents] = useState<string[]>(getRecentBlocks);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const categories: BlockCategory[] = ['Templates', 'Texto', 'Media', 'Layout', 'Editorial'];
  const normalizedQuery = query.trim().toLowerCase();
  // When searching, look across ALL categories; otherwise filter by the active tab.
  const visible = BLOCKS.filter((block) => {
    const matchesQuery = `${block.label} ${block.description}`.toLowerCase().includes(normalizedQuery);
    if (normalizedQuery) return matchesQuery;
    return block.category === category;
  });
  const recentBlocks = recents.map((k) => BLOCKS.find((b) => b.key === k)).filter(Boolean) as BlockDefinition[];

  const pick = (key: string) => { pushRecentBlock(key); onPick(key); };

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Reset highlight whenever the visible list changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery, category]);

  // Keep the highlighted item scrolled into view.
  useEffect(() => {
    const node = gridRef.current?.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, visible.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); const item = visible[activeIndex]; if (item) pick(item.key); }
    else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    else if (event.key === 'Tab' && !normalizedQuery) {
      event.preventDefault();
      const idx = categories.indexOf(category);
      const next = event.shiftKey ? (idx - 1 + categories.length) % categories.length : (idx + 1) % categories.length;
      setCategory(categories[next]);
    }
  };

  return (
    <div
      className="cms-block-picker"
      style={{ top: Math.min(y, window.innerHeight - 560), left: Math.min(x, window.innerWidth - 460) }}
      role="dialog"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="cms-block-picker-head">
        <span>Adicionar componente</span>
        <button type="button" onClick={onClose}>Esc</button>
      </div>
      <input
        ref={searchRef}
        className="cms-block-picker-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Pesquisar bloco… (↑↓ para navegar, ↵ para inserir)"
      />

      {!normalizedQuery && recentBlocks.length > 0 && (
        <div className="cms-block-picker-recents">
          <span className="cms-block-picker-section">Recentes</span>
          <div className="cms-block-picker-chips">
            {recentBlocks.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => pick(key)} title={label}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!normalizedQuery && (
        <div className="cms-block-picker-tabs">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? 'is-active' : undefined}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      <div className="cms-block-picker-grid" ref={gridRef}>
        {visible.length === 0 ? (
          <div className="cms-block-picker-empty">Nenhum bloco encontrado.</div>
        ) : (
          visible.map(({ key, label, description }, index) => (
            <button
              key={key}
              type="button"
              className={`cms-block-card${index === activeIndex ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(key)}
            >
              <BlockThumb variant={BLOCK_THUMB[key] ?? 'text'} />
              <strong>{label}</strong>
              <small>{description}</small>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function BlockMenu({
  menu,
  editor,
  onClose,
}: {
  menu: { pos: number; top: number; left: number; label: string };
  editor: NonNullable<ReturnType<typeof useEditor>>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const range = blockRange(editor, menu.pos);
  const node = range?.node;
  const isCallout = node?.type.name === 'cmsCallout';
  const isColumns = node?.type.name === 'cmsColumns';
  const isGallery = node?.type.name === 'cmsGallery';
  const isDivider = node?.type.name === 'cmsDivider';
  const hasSettings = isCallout || isColumns || isGallery || isDivider;

  // Close on outside click or Escape.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const updateAttrs = (attrs: Record<string, string | null>) => {
    if (!range || !node) return;
    editor.chain().focus().setNodeSelection(range.from).updateAttributes(node.type.name, attrs).run();
  };

  // Columns store their layout as real child nodes, so changing the count must
  // add/remove cmsColumn children — not just flip an attribute.
  const setColumnCount = (target: number) => {
    if (!range || !node || node.type.name !== 'cmsColumns') return;
    const cols: JSONContent[] = [];
    for (let i = 0; i < target; i++) {
      cols.push(i < node.childCount ? (node.child(i).toJSON() as JSONContent) : { type: 'cmsColumn', content: [{ type: 'paragraph' }] });
    }
    editor.chain().focus().insertContentAt(
      { from: range.from, to: range.to },
      { type: 'cmsColumns', attrs: { ...node.attrs, 'data-columns': String(target) }, content: cols },
    ).run();
  };

  const currentColumns = node?.childCount ?? 0;
  const currentVariant = (node?.attrs['data-variant'] as string) ?? 'info';
  const currentGallery = (node?.attrs['data-columns'] as string) ?? '3';

  const top = Math.min(menu.top + 30, window.innerHeight - 320);
  const left = Math.max(8, Math.min(menu.left - 48, window.innerWidth - 280));

  return (
    <div ref={ref} className="cms-block-menu" style={{ top, left }} role="menu">
      <div className="cms-block-menu-label">{menu.label}</div>

      {isCallout && (
        <div className="cms-block-menu-settings">
          <span className="cms-block-menu-section">Estilo</span>
          <div className="cms-seg">
            {([['info', 'Info'], ['success', 'Sucesso'], ['warning', 'Aviso'], ['danger', 'Perigo']] as const).map(([variant, label]) => (
              <button key={variant} type="button" className={currentVariant === variant ? 'is-active' : undefined} onClick={() => updateAttrs({ 'data-variant': variant })}>{label}</button>
            ))}
          </div>
        </div>
      )}
      {isColumns && (
        <div className="cms-block-menu-settings">
          <span className="cms-block-menu-section">Colunas</span>
          <div className="cms-seg">
            {([2, 3, 4] as const).map((count) => (
              <button key={count} type="button" className={currentColumns === count ? 'is-active' : undefined} onClick={() => setColumnCount(count)}>{count}</button>
            ))}
          </div>
        </div>
      )}
      {isGallery && (
        <div className="cms-block-menu-settings">
          <span className="cms-block-menu-section">Colunas da galeria</span>
          <div className="cms-seg">
            {(['2', '3', '4'] as const).map((columns) => (
              <button key={columns} type="button" className={currentGallery === columns ? 'is-active' : undefined} onClick={() => updateAttrs({ 'data-columns': columns })}>{columns}</button>
            ))}
          </div>
        </div>
      )}
      {isDivider && (
        <div className="cms-block-menu-settings">
          <span className="cms-block-menu-section">Estilo</span>
          <div className="cms-seg">
            {([['gold', 'Dourado'], ['asterisks', 'Asteriscos']] as const).map(([variant, label]) => (
              <button key={variant} type="button" className={currentVariant === variant ? 'is-active' : undefined} onClick={() => updateAttrs({ 'data-variant': variant })}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {hasSettings && <div className="cms-block-menu-divider" />}

      <button type="button" className="cms-block-menu-item" onClick={() => { duplicateBlock(editor, menu.pos); onClose(); }}>
        <Copy size={15} /> Duplicar
      </button>
      <button type="button" className="cms-block-menu-item" onClick={() => { moveBlock(editor, menu.pos, 'up'); onClose(); }}>
        <ArrowUp size={15} /> Mover para cima
      </button>
      <button type="button" className="cms-block-menu-item" onClick={() => { moveBlock(editor, menu.pos, 'down'); onClose(); }}>
        <ArrowDown size={15} /> Mover para baixo
      </button>
      <div className="cms-block-menu-divider" />
      <button type="button" className="cms-block-menu-item cms-block-menu-danger" onClick={() => { deleteBlock(editor, menu.pos); onClose(); }}>
        <Trash2 size={15} /> Apagar
      </button>
    </div>
  );
}

function ImageControls({
  image,
  onReplace,
  onAlt,
  onCaption,
  onFullWidth,
  onWidth,
  onAlign,
  onMoveUp,
  onMoveDown,
  onResizeStart,
}: {
  image: NonNullable<SelectedImage>;
  onReplace: () => void;
  onAlt: () => void;
  onCaption: () => void;
  onFullWidth: () => void;
  onWidth: (width: number | null) => void;
  onAlign: (align: 'left' | 'center' | 'right' | 'wide') => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onResizeStart: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const toolbarTop = Math.max(72, image.top - 54);
  const toolbarLeft = Math.min(Math.max(12, image.left), window.innerWidth - 520);
  const width = Math.round(image.attrWidth ?? image.width);

  return (
    <>
      <div className="cms-image-toolbar" style={{ top: toolbarTop, left: toolbarLeft }}>
        <button type="button" onClick={onReplace}>Substituir</button>
        <button type="button" onClick={onAlt}>Alt</button>
        <button type="button" onClick={onCaption}>Legenda</button>
        <span className="cms-image-toolbar-sep" />
        <button type="button" onClick={() => onWidth(320)}>Pequena</button>
        <button type="button" onClick={() => onWidth(560)}>Media</button>
        <button type="button" onClick={() => onWidth(820)}>Larga</button>
        <button type="button" onClick={onFullWidth}>100%</button>
        <span className="cms-image-toolbar-sep" />
        <button type="button" onClick={() => onAlign('left')}>Esq.</button>
        <button type="button" onClick={() => onAlign('center')}>Centro</button>
        <button type="button" onClick={() => onAlign('right')}>Dir.</button>
        <button type="button" onClick={() => onAlign('wide')}>Wide</button>
        <span className="cms-image-toolbar-sep" />
        <button type="button" onClick={onMoveUp} title="Mover imagem para cima"><ArrowUp size={14} /></button>
        <button type="button" onClick={onMoveDown} title="Mover imagem para baixo"><ArrowDown size={14} /></button>
      </div>
      <div
        className="cms-image-size-label"
        style={{ top: image.top + image.height + 8, left: image.left + Math.max(0, image.width / 2 - 38) }}
      >
        {width}px
      </div>
      <button
        type="button"
        className="cms-image-resize-handle"
        style={{ top: image.top + image.height - 13, left: image.left + image.width - 13 }}
        onMouseDown={onResizeStart}
        title="Arrastar para redimensionar"
      />
    </>
  );
}

function blockRange(editor: NonNullable<ReturnType<typeof useEditor>>, pos: number) {
  const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
  if ($pos.depth >= 1) {
    const node = $pos.node(1);
    return { from: $pos.before(1), to: $pos.after(1), node };
  }
  return null;
}

function blockEndPos(editor: NonNullable<ReturnType<typeof useEditor>>, pos: number) {
  return blockRange(editor, pos)?.to ?? pos;
}

function blockLabel(element: HTMLElement): string {
  const cmsBlock = element.getAttribute('data-cms-block');
  if (cmsBlock === 'section') return 'Secao';
  if (cmsBlock === 'callout') return 'Callout';
  if (cmsBlock === 'columns') return 'Colunas';
  if (cmsBlock === 'gallery') return 'Galeria';
  if (cmsBlock === 'divider') return 'Divisor';
  if (element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'H3' || element.tagName === 'H4') return 'Titulo';
  if (element.tagName === 'BLOCKQUOTE') return 'Citacao';
  if (element.tagName === 'IMG') return 'Imagem';
  if (element.tagName === 'UL' || element.tagName === 'OL') return 'Lista';
  if (element.tagName === 'TABLE') return 'Tabela';
  return 'Bloco';
}

function duplicateBlock(editor: NonNullable<ReturnType<typeof useEditor>>, pos: number) {
  const range = blockRange(editor, pos);
  if (!range) return;
  editor.chain().focus().insertContentAt(range.to, range.node.toJSON()).run();
}

function deleteBlock(editor: NonNullable<ReturnType<typeof useEditor>>, pos: number) {
  const range = blockRange(editor, pos);
  if (!range) return;
  editor.view.dispatch(editor.state.tr.delete(range.from, range.to));
}

// Read the current caption text of an image (empty unless it's wrapped in a figure).
function imageCaptionAt(editor: NonNullable<ReturnType<typeof useEditor>>, imgPos: number): string {
  const $pos = editor.state.doc.resolve(Math.min(imgPos, editor.state.doc.content.size));
  if ($pos.depth >= 1 && $pos.parent.type.name === 'cmsFigure') {
    const figcap = $pos.parent.maybeChild(1);
    return figcap?.textContent ?? '';
  }
  return '';
}

function topLevelBlocks(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const blocks: Array<{ from: number; to: number; node: ProseMirrorNode }> = [];
  editor.state.doc.forEach((node, offset) => {
    blocks.push({ from: offset, to: offset + node.nodeSize, node });
  });
  return blocks;
}

// Move the top-level block at `fromIndex` so it lands before original block
// `dropIndex` (dropIndex === blocks.length drops at the very end). Used by the
// drag-and-drop handle. delete-then-insert with a position adjustment for the
// removed node, matching moveBlock's approach.
function moveBlockToIndex(editor: NonNullable<ReturnType<typeof useEditor>>, fromIndex: number, dropIndex: number) {
  const blocks = topLevelBlocks(editor);
  if (fromIndex < 0 || fromIndex >= blocks.length) return;
  if (dropIndex === fromIndex || dropIndex === fromIndex + 1) return; // no-op
  const current = blocks[fromIndex];
  const tr = editor.state.tr.delete(current.from, current.to);
  let insertPos = dropIndex >= blocks.length ? blocks[blocks.length - 1].to : blocks[dropIndex].from;
  if (insertPos > current.from) insertPos -= current.node.nodeSize;
  tr.insert(insertPos, current.node);
  editor.view.dispatch(tr.scrollIntoView());
}

function moveBlock(editor: NonNullable<ReturnType<typeof useEditor>>, pos: number, direction: 'up' | 'down') {
  const blocks: Array<{ from: number; to: number; node: ProseMirrorNode }> = [];
  editor.state.doc.forEach((node, offset) => {
    blocks.push({ from: offset, to: offset + node.nodeSize, node });
  });
  const index = blocks.findIndex((block) => pos >= block.from && pos <= block.to);
  if (index < 0) return;
  const current = blocks[index];
  const target = direction === 'up' ? blocks[index - 1] : blocks[index + 1];
  if (!target || !current.node) return;
  const tr = editor.state.tr.delete(current.from, current.to);
  if (direction === 'up') {
    tr.insert(target.from, current.node);
  } else {
    tr.insert(target.to - current.node.nodeSize, current.node);
  }
  editor.view.dispatch(tr.scrollIntoView());
}

// Normalise a YouTube/Vimeo URL into an embeddable iframe src on a host the
// server-side sanitizer allows. Returns null for unrecognised links.
function toEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  if (/^https:\/\/(player\.vimeo\.com|www\.youtube(?:-nocookie)?\.com\/embed|w\.soundcloud\.com|gloria\.tv)\//.test(url)) return url;
  return null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] ?? char;
  });
}
