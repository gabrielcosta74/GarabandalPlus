"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import {
    Baseline, Bold, ChevronDown, Highlighter, Italic, Link2, List, ListOrdered, Redo2, RemoveFormatting, Strikethrough,
    TextAlignCenter, TextAlignEnd, TextAlignJustify, TextAlignStart, TextQuote, Underline, Undo2, Unlink, type LucideIcon,
} from 'lucide-react';
import { EMAIL_FONT, EMAIL_FONT_SIZE, EMAIL_TEXT_COLOR } from './email-html';

// Só letras que existem em todos os computadores e telemóveis: o destinatário
// tem de ver o mesmo que quem escreveu.
const FONTS: { label: string; value: string | null }[] = [
    { label: 'Sans Serif', value: null },
    { label: 'Serif', value: "Georgia, 'Times New Roman', serif" },
    { label: 'Largura fixa', value: "'Courier New', Courier, monospace" },
    { label: 'Larga', value: "'Arial Black', Arial, sans-serif" },
    { label: 'Estreita', value: "'Arial Narrow', Arial, sans-serif" },
    { label: 'Garamond', value: "Garamond, 'Times New Roman', serif" },
    { label: 'Tahoma', value: 'Tahoma, Verdana, sans-serif' },
    { label: 'Trebuchet', value: "'Trebuchet MS', Arial, sans-serif" },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
];

const SIZES: { label: string; value: string | null; preview: number }[] = [
    { label: 'Pequeno', value: '12px', preview: 12 },
    { label: 'Normal', value: null, preview: 14 },
    { label: 'Grande', value: '18px', preview: 18 },
    { label: 'Enorme', value: '26px', preview: 24 },
];

const TEXT_COLORS = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#ffffff',
    '#b91c1c', '#c2410c', '#a16207', '#15803d', '#0e7490', '#0f4c81',
    '#1d4ed8', '#6d28d9', '#be185d', '#7c2d12', '#365314', '#1e3a8a',
];
const HIGHLIGHTS = ['#fef08a', '#fde68a', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#fecaca'];

type ToolbarState = {
    bold: boolean; italic: boolean; underline: boolean; strike: boolean;
    bullet: boolean; ordered: boolean; quote: boolean; link: boolean; href: string;
    font: string | null; size: string | null; color: string | null; highlight: string | null;
    align: string; canUndo: boolean; canRedo: boolean;
};

// O useEditorState só calcula depois da primeira transação do editor; até
// lá a barra mostra isto. (Esperar por ele deixava o editor sem aparecer.)
const IDLE_STATE: ToolbarState = {
    bold: false, italic: false, underline: false, strike: false, bullet: false, ordered: false, quote: false,
    link: false, href: '', font: null, size: null, color: null, highlight: null, align: 'left', canUndo: false, canRedo: false,
};

export type MailEditorHandle = { focus: (position?: 'start' | 'end') => void; editor: Editor | null };

type Props = {
    initialHtml: string;
    onChange: (html: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    /** Barra compacta (ex.: editar a assinatura). */
    compact?: boolean;
    /** Por baixo do texto, no mesmo scroll (assinatura, mensagem original). */
    footer?: ReactNode;
};

const MailEditor = forwardRef<MailEditorHandle, Props>(function MailEditor({ initialHtml, onChange, placeholder, autoFocus, compact, footer }, ref) {
    const [linkOpen, setLinkOpen] = useState(false);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                code: false,
                horizontalRule: false,
                link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https' },
            }),
            TextStyle,
            Color,
            FontFamily,
            FontSize,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({ types: ['paragraph'] }),
            Placeholder.configure({ placeholder: placeholder || 'Escreva a mensagem…' }),
        ],
        content: initialHtml,
        autofocus: autoFocus ? 'start' : false,
        editorProps: {
            attributes: { class: 'mbx-ed-content', spellcheck: 'true', lang: 'pt' },
            handleKeyDown: (_view, event) => {
                if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                    event.preventDefault();
                    setLinkOpen(true);
                    return true;
                }
                return false;
            },
        },
        onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    });

    useImperativeHandle(ref, () => ({
        editor,
        focus: (position = 'start') => editor?.commands.focus(position),
    }), [editor]);

    const liveState = useEditorState({
        editor,
        selector: ({ editor: e }): ToolbarState | null => {
            if (!e) return null;
            const style = e.getAttributes('textStyle');
            return {
                bold: e.isActive('bold'),
                italic: e.isActive('italic'),
                underline: e.isActive('underline'),
                strike: e.isActive('strike'),
                bullet: e.isActive('bulletList'),
                ordered: e.isActive('orderedList'),
                quote: e.isActive('blockquote'),
                link: e.isActive('link'),
                href: (e.getAttributes('link').href as string | undefined) || '',
                font: (style.fontFamily as string | undefined) || null,
                size: (style.fontSize as string | undefined) || null,
                color: (style.color as string | undefined) || null,
                highlight: (e.getAttributes('highlight').color as string | undefined) || null,
                align: (['center', 'right', 'justify'].find((a) => e.isActive({ textAlign: a })) || 'left') as string,
                canUndo: e.can().undo(),
                canRedo: e.can().redo(),
            };
        },
    });

    if (!editor) return <div className="mbx-ed mbx-ed--loading" />;
    const state = liveState ?? IDLE_STATE;

    const chain = () => editor.chain().focus();
    const fontLabel = FONTS.find((f) => f.value === state.font)?.label || 'Sans Serif';
    const AlignIcon = { left: TextAlignStart, center: TextAlignCenter, right: TextAlignEnd, justify: TextAlignJustify }[state.align] || TextAlignStart;

    return (
        <div className={`mbx-ed${compact ? ' mbx-ed--compact' : ''}`}>
            <div className="mbx-ed-toolbar" role="toolbar" aria-label="Formatação">
                <Btn icon={Undo2} label="Anular (⌘Z)" onClick={() => chain().undo().run()} disabled={!state.canUndo} />
                <Btn icon={Redo2} label="Refazer (⌘⇧Z)" onClick={() => chain().redo().run()} disabled={!state.canRedo} />
                <Sep />
                <Popover label="Tipo de letra" trigger={<span className="mbx-ed-select" style={{ fontFamily: state.font || EMAIL_FONT }}>{fontLabel}<ChevronDown size={13} /></span>}>
                    {(close) => FONTS.map((f) => (
                        <button key={f.label} type="button" className={`mbx-ed-option${state.font === f.value ? ' is-on' : ''}`} style={{ fontFamily: f.value || EMAIL_FONT }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { (f.value ? chain().setFontFamily(f.value) : chain().unsetFontFamily()).run(); close(); }}>
                            {f.label}
                        </button>
                    ))}
                </Popover>
                <Popover label="Tamanho" trigger={<span className="mbx-ed-select mbx-ed-select--icon"><CaseIcon /><ChevronDown size={13} /></span>}>
                    {(close) => SIZES.map((s) => (
                        <button key={s.label} type="button" className={`mbx-ed-option${state.size === s.value ? ' is-on' : ''}`} style={{ fontSize: s.preview }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { (s.value ? chain().setFontSize(s.value) : chain().unsetFontSize()).run(); close(); }}>
                            {s.label}
                        </button>
                    ))}
                </Popover>
                <Sep />
                <Btn icon={Bold} label="Negrito (⌘B)" active={state.bold} onClick={() => chain().toggleBold().run()} />
                <Btn icon={Italic} label="Itálico (⌘I)" active={state.italic} onClick={() => chain().toggleItalic().run()} />
                <Btn icon={Underline} label="Sublinhado (⌘U)" active={state.underline} onClick={() => chain().toggleUnderline().run()} />
                {!compact && <Btn icon={Strikethrough} label="Riscado" active={state.strike} onClick={() => chain().toggleStrike().run()} />}
                <Popover label="Cor do texto" trigger={<span className="mbx-ed-color"><Baseline size={16} /><i style={{ background: state.color || EMAIL_TEXT_COLOR }} /></span>}>
                    {(close) => (
                        <div className="mbx-ed-palette">
                            <div className="mbx-ed-palette-title">Cor do texto</div>
                            <div className="mbx-ed-swatches">
                                {TEXT_COLORS.map((c) => (
                                    <button key={c} type="button" title={c} className={`mbx-ed-swatch${state.color === c ? ' is-on' : ''}`} style={{ background: c }}
                                        onMouseDown={(e) => e.preventDefault()} onClick={() => { chain().setColor(c).run(); close(); }} />
                                ))}
                            </div>
                            <button type="button" className="mbx-ed-reset" onMouseDown={(e) => e.preventDefault()} onClick={() => { chain().unsetColor().run(); close(); }}>Cor normal</button>
                        </div>
                    )}
                </Popover>
                <Popover label="Realçar" trigger={<span className="mbx-ed-color"><Highlighter size={16} /><i style={{ background: state.highlight || 'transparent', borderColor: state.highlight ? 'transparent' : '#cbd5e1' }} /></span>}>
                    {(close) => (
                        <div className="mbx-ed-palette">
                            <div className="mbx-ed-palette-title">Realçar</div>
                            <div className="mbx-ed-swatches mbx-ed-swatches--4">
                                {HIGHLIGHTS.map((c) => (
                                    <button key={c} type="button" title={c} className={`mbx-ed-swatch${state.highlight === c ? ' is-on' : ''}`} style={{ background: c }}
                                        onMouseDown={(e) => e.preventDefault()} onClick={() => { chain().setHighlight({ color: c }).run(); close(); }} />
                                ))}
                            </div>
                            <button type="button" className="mbx-ed-reset" onMouseDown={(e) => e.preventDefault()} onClick={() => { chain().unsetHighlight().run(); close(); }}>Sem realce</button>
                        </div>
                    )}
                </Popover>
                <Sep />
                <Popover label="Alinhamento" trigger={<span className="mbx-ed-select mbx-ed-select--icon"><AlignIcon size={16} /><ChevronDown size={13} /></span>}>
                    {(close) => (
                        <div className="mbx-ed-row">
                            {([['left', TextAlignStart, 'Esquerda'], ['center', TextAlignCenter, 'Centro'], ['right', TextAlignEnd, 'Direita'], ['justify', TextAlignJustify, 'Justificado']] as const).map(([value, Icon, label]) => (
                                <button key={value} type="button" title={label} className={`mbx-ed-btn${state.align === value ? ' is-on' : ''}`}
                                    onMouseDown={(e) => e.preventDefault()} onClick={() => { chain().setTextAlign(value).run(); close(); }}>
                                    <Icon size={16} />
                                </button>
                            ))}
                        </div>
                    )}
                </Popover>
                <Btn icon={List} label="Lista com pontos (⌘⇧8)" active={state.bullet} onClick={() => chain().toggleBulletList().run()} />
                <Btn icon={ListOrdered} label="Lista numerada (⌘⇧7)" active={state.ordered} onClick={() => chain().toggleOrderedList().run()} />
                {!compact && <Btn icon={TextQuote} label="Citação" active={state.quote} onClick={() => chain().toggleBlockquote().run()} />}
                <Sep />
                <LinkButton editor={editor} open={linkOpen} setOpen={setLinkOpen} active={state.link} href={state.href} />
                <Btn icon={RemoveFormatting} label="Limpar formatação" onClick={() => chain().unsetAllMarks().unsetTextAlign().clearNodes().run()} />
            </div>
            <div className="mbx-ed-area" onMouseDown={(e) => {
                // Clicar no espaço vazio leva o cursor para o fim do texto.
                if (e.target === e.currentTarget) { e.preventDefault(); editor.commands.focus('end'); }
            }}>
                <EditorContent editor={editor} className="mbx-ed-doc" style={{ fontFamily: EMAIL_FONT, fontSize: EMAIL_FONT_SIZE, color: EMAIL_TEXT_COLOR }} />
                {footer}
            </div>
        </div>
    );
});

export default MailEditor;

function CaseIcon() {
    return <span className="mbx-ed-case" aria-hidden><span>T</span><span>T</span></span>;
}

function Sep() {
    return <span className="mbx-ed-sep" aria-hidden />;
}

function Btn({ icon: Icon, label, onClick, active, disabled }: { icon: LucideIcon; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
    return (
        <button type="button" className={`mbx-ed-btn${active ? ' is-on' : ''}`} title={label} aria-label={label} aria-pressed={active}
            disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
            <Icon size={16} strokeWidth={active ? 2.5 : 2} />
        </button>
    );
}

/** Menu que abre por baixo do botão; fecha ao clicar fora ou com Esc. */
function Popover({ label, trigger, children, open: controlledOpen, setOpen: setControlledOpen }: {
    label: string;
    trigger: ReactNode;
    children: (close: () => void) => ReactNode;
    open?: boolean;
    setOpen?: (open: boolean) => void;
}) {
    const [localOpen, setLocalOpen] = useState(false);
    const open = controlledOpen ?? localOpen;
    const setOpen = setControlledOpen ?? setLocalOpen;
    const box = useRef<HTMLDivElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (!open) return;
        // Posição fixa calculada a partir do botão: a barra pode ter scroll
        // horizontal (telemóvel), e um menu absoluto ficaria cortado por ela.
        const rect = box.current?.getBoundingClientRect();
        if (rect) {
            const top = rect.bottom + 6;
            setPosition(rect.left + 280 > window.innerWidth
                ? { top, right: Math.max(8, window.innerWidth - rect.right) }
                : { top, left: Math.max(8, rect.left) });
        }
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!box.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
        const onScroll = (e: Event) => {
            if (!(e.target instanceof Node) || !menu.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [open, setOpen]);

    return (
        <div className="mbx-ed-pop" ref={box}>
            <button type="button" className={`mbx-ed-btn mbx-ed-btn--wide${open ? ' is-open' : ''}`} title={label} aria-label={label} aria-expanded={open}
                onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}>
                {trigger}
            </button>
            {open && <div ref={menu} className="mbx-ed-menu" style={position} role="menu">{children(() => setOpen(false))}</div>}
        </div>
    );
}

function LinkButton({ editor, open, setOpen, active, href }: { editor: Editor; open: boolean; setOpen: (open: boolean) => void; active: boolean; href: string }) {
    const [url, setUrl] = useState('');
    const [text, setText] = useState('');
    const hasSelection = !editor.state.selection.empty;

    useEffect(() => {
        if (!open) return;
        setUrl(href);
        setText('');
    }, [open, href]);

    const apply = () => {
        const value = url.trim();
        if (!value) return;
        const link = /^(https?:|mailto:|tel:)/i.test(value) ? value : value.includes('@') && !value.includes('/') ? `mailto:${value}` : `https://${value}`;
        if (active || hasSelection) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run();
        } else {
            const label = text.trim() || value;
            editor.chain().focus().insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href: link } }] }).insertContent(' ').run();
        }
        setOpen(false);
    };

    return (
        <Popover label="Link (⌘K)" open={open} setOpen={setOpen}
            trigger={<span className={`mbx-ed-select mbx-ed-select--icon${active ? ' is-active' : ''}`}><Link2 size={16} /></span>}>
            {() => (
                <form className="mbx-ed-link" onSubmit={(e) => { e.preventDefault(); apply(); }}>
                    {!active && !hasSelection && (
                        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Texto a mostrar (opcional)" />
                    )}
                    <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… ou email" />
                    <div className="mbx-ed-link-actions">
                        {active && (
                            <button type="button" className="mbx-ed-reset" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setOpen(false); }}>
                                <Unlink size={14} /> Tirar link
                            </button>
                        )}
                        <button type="submit" className="mbx-ed-apply" disabled={!url.trim()}>Aplicar</button>
                    </div>
                </form>
            )}
        </Popover>
    );
}
