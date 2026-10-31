"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Composer from './_components/Composer';
import {
    NotConfigured, SessionExpired, accessToken, api, avatarColor, errorMessage, formatSize, fullAddress, headerAddress, initials, post,
    type Address, type Draft,
} from './_components/mail-api';
import { clearAutosave, htmlToText, loadAutosave, loadBranded, loadSignatureSettings, saveAutosave } from './_components/email-html';
import { buildEmail, signatureText } from './_components/email-template';
import { Toaster, toast } from 'sonner';
import {
    Archive, ArrowLeft, Check, CheckCheck, File, FolderInput, Forward, Inbox, Keyboard, Loader2, Mail, MailOpen, Menu,
    Paperclip, PenSquare, RefreshCw, Reply, ReplyAll, Search, Send, ShieldAlert, Star, Trash2, Users, X, type LucideIcon,
} from 'lucide-react';

type Folder = { path: string; name: string; specialUse: string | null; total: number; unseen: number };
type Summary = {
    uid: number; subject: string; from: Address[]; to: Address[]; date: string | null;
    seen: boolean; flagged: boolean; answered: boolean; hasAttachments: boolean; size: number;
};
type Message = Summary & {
    cc: Address[]; replyTo: Address[]; messageId: string | null; references: string[];
    html: string; text: string; attachments: { index: number; filename: string; contentType: string; size: number }[];
};
type Op = 'seen' | 'unseen' | 'flag' | 'unflag' | 'trash' | 'move';

const FOLDER_ICONS: Record<string, LucideIcon> = {
    '\\Inbox': Inbox, '\\Sent': Send, '\\Drafts': File, '\\Trash': Trash2, '\\Junk': ShieldAlert, '\\Archive': Archive,
};

const who = (list: Address[]) => list.map((a) => a.name || a.address).join(', ') || '—';

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const formatListDate = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
};
const formatFullDate = (value: string | null) =>
    value ? new Date(value).toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/** Separadores da lista: Hoje, Ontem, Esta semana e depois por mês. */
const dayGroup = (value: string | null) => {
    if (!value) return 'Sem data';
    const date = new Date(value);
    const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
    if (days <= 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    if (days < 7) return 'Esta semana';
    const month = date.toLocaleDateString('pt-PT', { month: 'long' });
    return date.getFullYear() === new Date().getFullYear() ? month[0].toUpperCase() + month.slice(1) : `${month[0].toUpperCase() + month.slice(1)} de ${date.getFullYear()}`;
};

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const textLines = (text: string) =>
    (text || '').trim().split('\n').map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`).join('');

/** Mensagem original por baixo da resposta (fica fora do editor, como no Gmail). */
const quoteOf = (msg: Message, kind: 'reply' | 'forward') => {
    if (kind === 'forward') {
        const header = [
            ['De', msg.from.map(fullAddress).join(', ')],
            ['Data', formatFullDate(msg.date)],
            ['Assunto', msg.subject],
            ['Para', msg.to.map(fullAddress).join(', ')],
        ].map(([k, v]) => `<p>${k}: ${escapeHtml(v)}</p>`).join('');
        return `<p>---------- Mensagem reencaminhada ----------</p>${header}<p><br></p>${textLines(msg.text)}`;
    }
    return `<p>No dia ${escapeHtml(formatFullDate(msg.date))}, ${escapeHtml(who(msg.from))} escreveu:</p><blockquote>${textLines(msg.text)}</blockquote>`;
};

const prefixed = (prefix: string, subject: string) =>
    new RegExp(`^${prefix}:`, 'i').test(subject) ? subject : `${prefix}: ${subject}`;

const newDraft = (mode: Draft['mode']): Draft => ({ mode, to: [], cc: [], bcc: [], subject: '', html: '<p></p>' });

const UNDO_MS = 5000;

const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

const SHORTCUTS: [string, string][] = [
    ['j / ↓', 'Mensagem seguinte'], ['k / ↑', 'Mensagem anterior'], ['r', 'Responder'], ['a', 'Responder a todos'],
    ['f', 'Reencaminhar'], ['s', 'Estrela'], ['u', 'Marcar como não lida'], ['#  ou  Delete', 'Apagar'],
    ['c', 'Escrever'], ['/', 'Procurar'], ['Esc', 'Fechar'], ['⌘/Ctrl + Enter', 'Enviar (ao escrever)'],
];

/**
 * Caixa geral (geral@…) em ecrã inteiro: ler, responder, escrever e enviar a
 * grupos (inscritos de peregrinações, membros). O email continua alojado no
 * fornecedor; isto é só um cliente IMAP/SMTP.
 */
export default function AdminEmailPage() {
    const [address, setAddress] = useState<string | null>(null);
    const [notConfigured, setNotConfigured] = useState<string | null>(null);
    const [sessionExpired, setSessionExpired] = useState(false);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [folder, setFolder] = useState('INBOX');
    const [items, setItems] = useState<Summary[]>([]);
    const [total, setTotal] = useState(0);
    const [pagesLoaded, setPagesLoaded] = useState(0);
    const [listLoading, setListLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [search, setSearch] = useState('');
    const [unseenOnly, setUnseenOnly] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [openUid, setOpenUid] = useState<number | null>(null);
    const [message, setMessage] = useState<Message | null>(null);
    const [messageLoading, setMessageLoading] = useState(false);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [composerKey, setComposerKey] = useState(0);
    const [draftRestored, setDraftRestored] = useState(false);
    const pendingSends = useRef(0);
    const folderRef = useRef(folder);
    folderRef.current = folder;
    const [foldersOpen, setFoldersOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    const searchInput = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const sentinel = useRef<HTMLDivElement>(null);
    const listRequest = useRef(0);
    const messageRequest = useRef(0);

    const handleError = useCallback((error: unknown) => {
        if (error instanceof NotConfigured) setNotConfigured(error.message);
        else if (error instanceof SessionExpired) setSessionExpired(true);
        else toast.error(errorMessage(error));
    }, []);

    const currentFolder = folders.find((f) => f.path === folder);
    const isSentFolder = currentFolder?.specialUse === '\\Sent' || currentFolder?.specialUse === '\\Drafts';
    const inboxUnseen = folders.find((f) => f.specialUse === '\\Inbox' || f.path === 'INBOX')?.unseen ?? 0;

    useEffect(() => {
        document.title = `${inboxUnseen ? `(${inboxUnseen}) ` : ''}Email geral · Admin`;
    }, [inboxUnseen]);

    const loadFolders = useCallback(async () => {
        try {
            const data = await api({ view: 'folders' });
            setAddress(data.address);
            setFolders(data.folders);
        } catch (error) {
            handleError(error);
        }
    }, [handleError]);

    /** Página 1 substitui (mantendo as mais antigas já carregadas); as outras acrescentam. */
    const loadPage = useCallback(async (page: number, mode: 'reset' | 'append' | 'refresh') => {
        const request = ++listRequest.current;
        if (mode !== 'refresh') setListLoading(true);
        try {
            const data = await api({ view: 'messages', folder, page, q: search, unseen: unseenOnly ? 1 : 0 });
            if (request !== listRequest.current) return;
            const incoming: Summary[] = data.messages;
            setTotal(data.total);
            if (mode === 'reset') {
                setItems(incoming);
                setPagesLoaded(1);
            } else if (mode === 'append') {
                setItems((prev) => [...prev, ...incoming.filter((m) => !prev.some((p) => p.uid === m.uid))]);
                setPagesLoaded(page);
            } else {
                const oldest = incoming.length ? Math.min(...incoming.map((m) => m.uid)) : Infinity;
                setItems((prev) => [...incoming, ...prev.filter((m) => m.uid < oldest)]);
            }
        } catch (error) {
            if (request === listRequest.current) handleError(error);
        } finally {
            if (request === listRequest.current) setListLoading(false);
        }
    }, [folder, search, unseenOnly, handleError]);

    useEffect(() => { loadFolders(); }, [loadFolders]);
    useEffect(() => {
        if (notConfigured || sessionExpired) return;
        setSelected(new Set());
        listRef.current?.scrollTo({ top: 0 });
        loadPage(1, 'reset');
    }, [loadPage, notConfigured, sessionExpired]);

    // Novas mensagens e contadores sem recarregar a página.
    useEffect(() => {
        const timer = setInterval(() => {
            if (document.visibilityState !== 'visible' || notConfigured || sessionExpired) return;
            loadFolders();
            loadPage(1, 'refresh');
        }, 45_000);
        return () => clearInterval(timer);
    }, [loadFolders, loadPage, notConfigured, sessionExpired]);

    // Scroll infinito: quando o fim da lista aparece, vem a página seguinte.
    const hasMore = items.length < total;
    useEffect(() => {
        const node = sentinel.current;
        if (!node || !hasMore) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting && !listLoading) loadPage(pagesLoaded + 1, 'append');
        }, { root: listRef.current, rootMargin: '400px' });
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, listLoading, loadPage, pagesLoaded]);

    const patchItems = (uids: number[], patch: Partial<Summary>) =>
        setItems((prev) => prev.map((m) => (uids.includes(m.uid) ? { ...m, ...patch } : m)));

    const adjustUnseen = (delta: number) =>
        setFolders((prev) => prev.map((f) => (f.path === folder ? { ...f, unseen: Math.max(0, f.unseen + delta) } : f)));

    const closeMessage = () => {
        messageRequest.current += 1;
        setOpenUid(null);
        setMessage(null);
        setMessageLoading(false);
    };

    const openMessage = useCallback(async (uid: number) => {
        const request = ++messageRequest.current;
        setOpenUid(uid);
        setMessage(null);
        setMessageLoading(true);
        const summary = items.find((m) => m.uid === uid);
        if (summary && !summary.seen) {
            patchItems([uid], { seen: true });
            adjustUnseen(-1);
        }
        try {
            const data: Message = await api({ view: 'message', folder, uid });
            if (request === messageRequest.current) setMessage(data);
        } catch (error) {
            if (request === messageRequest.current) {
                handleError(error);
                setOpenUid(null);
            }
        } finally {
            if (request === messageRequest.current) setMessageLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, folder, handleError]);

    const changeFolder = (path: string) => {
        setFolder(path);
        setFoldersOpen(false);
        setQuery('');
        setSearch('');
        closeMessage();
    };

    /** Ações em uma ou várias mensagens, refletidas logo no ecrã. */
    const act = async (op: Op, uids: number[], destination?: string) => {
        if (!uids.length) return;
        const affected = items.filter((m) => uids.includes(m.uid));
        const removes = op === 'trash' || op === 'move';
        const openIndex = openUid ? items.findIndex((m) => m.uid === openUid) : -1;

        if (removes) {
            setItems((prev) => prev.filter((m) => !uids.includes(m.uid)));
            setTotal((t) => Math.max(0, t - uids.length));
            adjustUnseen(-affected.filter((m) => !m.seen).length);
        } else if (op === 'seen' || op === 'unseen') {
            const changing = affected.filter((m) => m.seen !== (op === 'seen'));
            patchItems(uids, { seen: op === 'seen' });
            adjustUnseen(op === 'seen' ? -changing.length : changing.length);
        } else {
            patchItems(uids, { flagged: op === 'flag' });
            if (message && uids.includes(message.uid)) setMessage({ ...message, flagged: op === 'flag' });
        }
        setSelected(new Set());

        if (openUid && uids.includes(openUid)) {
            if (removes) {
                // Como no Outlook: a seguinte abre logo, para despachar a caixa.
                const rest = items.filter((m) => !uids.includes(m.uid));
                const next = rest[Math.min(openIndex, rest.length - 1)];
                if (next) openMessage(next.uid);
                else closeMessage();
            } else if (op === 'unseen') {
                closeMessage();
            }
        }

        try {
            await post({ action: 'update', folder, uids, op, destination });
            if (removes) toast.success(op === 'trash' ? (uids.length > 1 ? `${uids.length} apagadas.` : 'Apagada.') : 'Movida.');
            if (removes) loadFolders();
        } catch (error) {
            handleError(error);
            loadPage(1, 'reset');
            loadFolders();
        }
    };

    const openDraft = (next: Draft, restored = false) => {
        setDraftRestored(restored);
        setComposerKey((k) => k + 1);
        setDraft(next);
    };

    /** Escrever: se ficou um rascunho por enviar, volta a abrir esse. */
    const compose = (mode: Draft['mode']) => {
        const saved = loadAutosave();
        if (saved && saved.draft.mode === mode && !saved.draft.inReplyTo) openDraft({ ...newDraft(mode), ...saved.draft }, true);
        else openDraft(newDraft(mode));
    };

    // Avisar antes de fechar o separador com um envio ainda por sair.
    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!pendingSends.current) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);

    /** Fecha logo o compositor e só envia ao fim de 5 s — dá para anular, como no Gmail. */
    const queueSend = (sending: Draft) => {
        setDraft(null);
        clearAutosave();
        pendingSends.current += 1;
        let cancelled = false;
        const label = sending.mode === 'group' ? 'ao grupo' : `para ${sending.to.map((a) => a.name || a.address).join(', ')}`;
        const id = toast(`A enviar ${label}…`, {
            duration: UNDO_MS,
            action: {
                label: 'Anular',
                onClick: () => {
                    cancelled = true;
                    pendingSends.current -= 1;
                    openDraft(sending);
                },
            },
        });

        setTimeout(async () => {
            if (cancelled) return;
            toast.loading(`A enviar ${label}…`, { id, action: undefined, duration: Infinity });
            const signature = loadSignatureSettings();
            const html = buildEmail({
                body: sending.html,
                quote: sending.quote,
                signature,
                from: address,
                branded: sending.branded ?? loadBranded(),
            });
            const common = {
                subject: sending.subject.trim(),
                html,
                text: [htmlToText(sending.html), signatureText(signature, address), sending.quote ? htmlToText(sending.quote) : '']
                    .filter(Boolean).join('\n\n'),
                attachments: (sending.files || []).map(({ filename, contentType, content }) => ({ filename, contentType, content })),
            };
            try {
                if (sending.mode === 'group') {
                    const result = await post({ action: 'group', groupId: sending.groupId, ...common });
                    if (result.failed?.length) toast.warning(`Enviado a ${result.sent}; falhou para ${result.failed.length}.`, { id, duration: 8000 });
                    else toast.success(`Enviado a ${result.sent} pessoas.`, { id, duration: 4000 });
                } else {
                    await post({
                        action: 'send',
                        to: sending.to.map(headerAddress),
                        cc: sending.cc.map(headerAddress),
                        bcc: sending.bcc.map(headerAddress),
                        ...common,
                        inReplyTo: sending.inReplyTo,
                        references: sending.references,
                        answered: sending.answered,
                    });
                    toast.success('Mensagem enviada.', { id, duration: 3000 });
                }
                if (sending.answered && sending.answered.folder === folderRef.current) patchItems([sending.answered.uid], { answered: true });
                loadFolders();
            } catch (error) {
                saveAutosave(sending);
                toast.error(`Não foi enviada: ${errorMessage(error)}`, {
                    id, duration: 15000, action: { label: 'Abrir', onClick: () => openDraft(sending) },
                });
            } finally {
                pendingSends.current -= 1;
            }
        }, UNDO_MS);
    };

    const reply = useCallback((kind: 'reply' | 'all' | 'forward') => {
        if (!message) return;
        const own = (address || '').toLowerCase();
        const replyTo = message.replyTo.length ? message.replyTo : message.from;
        const others = [...message.to, ...message.cc].filter((a) => a.address.toLowerCase() !== own && !replyTo.some((r) => r.address === a.address));
        openDraft({
            mode: 'single',
            to: kind === 'forward' ? [] : replyTo,
            cc: kind === 'all' ? others : [],
            bcc: [],
            subject: prefixed(kind === 'forward' ? 'Fwd' : 'Re', message.subject),
            html: '<p></p>',
            quote: quoteOf(message, kind === 'forward' ? 'forward' : 'reply'),
            inReplyTo: kind === 'forward' ? null : message.messageId,
            references: kind === 'forward' ? [] : [...message.references, ...(message.messageId ? [message.messageId] : [])],
            answered: kind === 'forward' ? null : { folder, uid: message.uid },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message, address, folder]);

    const downloadAttachment = async (index: number, filename: string) => {
        if (!message) return;
        const loading = toast.loading(`A descarregar ${filename}…`);
        try {
            const token = await accessToken();
            const res = await fetch(`/api/admin/mailbox?${new URLSearchParams({ view: 'attachment', folder, uid: String(message.uid), index: String(index) })}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Não foi possível descarregar o anexo.');
            const url = URL.createObjectURL(await res.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
            toast.dismiss(loading);
        } catch (error) {
            toast.dismiss(loading);
            handleError(error);
        }
    };

    // Atalhos de teclado (fora dos campos de texto e com o compositor fechado).
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (draft || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
            const index = openUid ? items.findIndex((m) => m.uid === openUid) : -1;
            const go = (delta: number) => {
                const next = items[index === -1 ? 0 : index + delta];
                if (next) {
                    openMessage(next.uid);
                    document.querySelector(`[data-uid="${next.uid}"]`)?.scrollIntoView({ block: 'nearest' });
                }
            };
            const handlers: Record<string, () => void> = {
                j: () => go(1), ArrowDown: () => go(1), k: () => go(-1), ArrowUp: () => go(-1),
                r: () => reply('reply'), a: () => reply('all'), f: () => reply('forward'),
                s: () => message && act(message.flagged ? 'unflag' : 'flag', [message.uid]),
                u: () => message && act('unseen', [message.uid]),
                '#': () => message && act('trash', [message.uid]),
                Delete: () => message && act('trash', [message.uid]),
                c: () => compose('single'),
                '/': () => searchInput.current?.focus(),
                '?': () => setHelpOpen((v) => !v),
                Escape: () => { if (helpOpen) setHelpOpen(false); else if (selected.size) setSelected(new Set()); else closeMessage(); },
            };
            const handler = handlers[event.key];
            if (handler) {
                event.preventDefault();
                handler();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const toggleSelected = (uid: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid); else next.add(uid);
            return next;
        });

    const selectedUids = [...selected];
    const selectedItems = items.filter((m) => selected.has(m.uid));
    const moveTargets = folders.filter((f) => f.path !== folder && f.specialUse !== '\\Drafts');
    const inTrash = currentFolder?.specialUse === '\\Trash';

    const confirmTrash = (count: number) => !inTrash || window.confirm(count > 1 ? `Apagar ${count} mensagens de vez?` : 'Apagar esta mensagem de vez?');

    // Sugestões imediatas no "Para": quem já aparece nas mensagens carregadas.
    const recentAddresses = useMemo(() => {
        const own = (address || '').toLowerCase();
        const seen = new Map<string, Address>();
        for (const m of items) {
            for (const a of [...m.from, ...m.to]) {
                const key = a.address.toLowerCase();
                if (key && key !== own && !seen.has(key)) seen.set(key, a);
            }
        }
        return [...seen.values()].slice(0, 300);
    }, [items, address]);

    const grouped = useMemo(() => {
        const out: { label: string; items: Summary[] }[] = [];
        for (const m of items) {
            const label = dayGroup(m.date);
            if (out[out.length - 1]?.label !== label) out.push({ label, items: [] });
            out[out.length - 1].items.push(m);
        }
        return out;
    }, [items]);

    if (sessionExpired) {
        return (
            <div className="mbx-page">
                <TopBar address={address} />
                <div className="mbx-empty mbx-empty--big">
                    <Mail size={30} />
                    <span>A sessão de admin terminou.</span>
                    <Link href="/admin" className="mbx-primary" style={{ textDecoration: 'none' }}>Entrar no admin</Link>
                </div>
                <style>{STYLES}</style>
            </div>
        );
    }

    if (notConfigured) {
        return (
            <div className="mbx-page">
                <TopBar address={address} />
                <div style={{ padding: 24 }}><NotConfiguredCard message={notConfigured} /></div>
                <style>{STYLES}</style>
            </div>
        );
    }

    return (
        <div className={`mbx-page${openUid ? ' mbx--reading' : ''}`}>
            <Toaster position="top-center" richColors />

            <TopBar address={address}>
                <button type="button" className="mbx-icon mbx-menu" aria-label="Pastas" onClick={() => setFoldersOpen((v) => !v)}><Menu size={18} /></button>
                <form onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); }} className="mbx-search">
                    <Search size={16} />
                    <input ref={searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Procurar em ${currentFolder?.name || 'Caixa de entrada'}`} />
                    {(query || search) && (
                        <button type="button" aria-label="Limpar pesquisa" onClick={() => { setQuery(''); setSearch(''); }}><X size={14} /></button>
                    )}
                </form>
                <button type="button" className="mbx-icon" title="Atalhos de teclado (?)" onClick={() => setHelpOpen(true)}><Keyboard size={17} /></button>
            </TopBar>

            <div className="mbx">
                {/* Pastas */}
                <aside className={`mbx-folders${foldersOpen ? ' is-open' : ''}`}>
                    <button type="button" className="mbx-primary" onClick={() => compose('single')}>
                        <PenSquare size={16} /> Escrever
                    </button>
                    <button type="button" className="mbx-secondary" onClick={() => compose('group')}>
                        <Users size={16} /> Escrever a um grupo
                    </button>
                    <nav>
                        {folders.length === 0 && Array.from({ length: 5 }).map((_, i) => <div key={i} className="mbx-skeleton" style={{ height: 30 }} />)}
                        {folders.map((f) => {
                            const Icon = (f.specialUse && FOLDER_ICONS[f.specialUse]) || Mail;
                            return (
                                <button key={f.path} type="button" onClick={() => changeFolder(f.path)} className={`mbx-folder${f.path === folder ? ' is-active' : ''}`}>
                                    <Icon size={16} />
                                    <span className="mbx-folder-name">{f.name}</span>
                                    {f.unseen > 0 && <span className="mbx-count">{f.unseen}</span>}
                                </button>
                            );
                        })}
                    </nav>
                </aside>
                {foldersOpen && <div className="mbx-scrim" onClick={() => setFoldersOpen(false)} />}

                {/* Lista */}
                <section className="mbx-list">
                    <div className="mbx-list-head">
                        {selected.size > 0 ? (
                            <div className="mbx-bulk">
                                <button type="button" className="mbx-icon" title="Limpar seleção" onClick={() => setSelected(new Set())}><X size={16} /></button>
                                <strong>{selected.size}</strong>
                                <span className="mbx-toolbar-gap" />
                                <button type="button" className="mbx-icon" title="Marcar como lidas" onClick={() => act('seen', selectedUids)}><MailOpen size={16} /></button>
                                <button type="button" className="mbx-icon" title="Marcar como não lidas" onClick={() => act('unseen', selectedUids)}><Mail size={16} /></button>
                                <button type="button" className="mbx-icon" title="Estrela" onClick={() => act(selectedItems.every((m) => m.flagged) ? 'unflag' : 'flag', selectedUids)}><Star size={16} /></button>
                                {moveTargets.length > 0 && (
                                    <MoveMenu folders={moveTargets} onMove={(path) => act('move', selectedUids, path)} />
                                )}
                                <button type="button" className="mbx-icon mbx-danger" title="Apagar" onClick={() => confirmTrash(selected.size) && act('trash', selectedUids)}><Trash2 size={16} /></button>
                            </div>
                        ) : (
                            <div className="mbx-list-tools">
                                <div className="mbx-list-title">
                                    <strong>{search ? `“${search}”` : currentFolder?.name || 'Caixa de entrada'}</strong>
                                    <span>{total.toLocaleString('pt-PT')}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <button type="button" className={`mbx-pill${unseenOnly ? ' is-on' : ''}`} onClick={() => setUnseenOnly((v) => !v)}>Não lidas</button>
                                    {items.some((m) => !m.seen) && (
                                        <button type="button" className="mbx-icon" title="Marcar as visíveis como lidas" onClick={() => act('seen', items.filter((m) => !m.seen).map((m) => m.uid))}><CheckCheck size={16} /></button>
                                    )}
                                    <button type="button" className="mbx-icon" title="Atualizar" onClick={() => { loadPage(1, 'refresh'); loadFolders(); }}>
                                        <RefreshCw size={15} className={listLoading ? 'mbx-spin' : ''} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mbx-items" ref={listRef}>
                        {listLoading && items.length === 0 && Array.from({ length: 8 }).map((_, i) => <div key={i} className="mbx-skeleton mbx-skeleton--row" />)}
                        {!listLoading && items.length === 0 && (
                            <div className="mbx-empty mbx-empty--big"><Inbox size={26} />{search ? 'Nada encontrado.' : unseenOnly ? 'Não há mensagens por ler.' : 'Pasta vazia.'}</div>
                        )}
                        {grouped.map((group) => (
                            <div key={group.label}>
                                <div className="mbx-day">{group.label}</div>
                                {group.items.map((m) => {
                                    const person = isSentFolder ? m.to[0] : m.from[0];
                                    const isSelected = selected.has(m.uid);
                                    return (
                                        <div key={m.uid} data-uid={m.uid}
                                            className={`mbx-item${m.seen ? '' : ' is-unseen'}${m.uid === openUid ? ' is-open' : ''}${isSelected ? ' is-selected' : ''}`}
                                            onClick={() => openMessage(m.uid)}>
                                            <button type="button" className="mbx-avatar" style={{ background: isSelected ? '#0f4c81' : avatarColor(person) }}
                                                aria-label={isSelected ? 'Tirar da seleção' : 'Selecionar'}
                                                onClick={(e) => { e.stopPropagation(); toggleSelected(m.uid); }}>
                                                {isSelected ? <Check size={16} /> : <span>{initials(person)}</span>}
                                            </button>
                                            <div className="mbx-item-main">
                                                <div className="mbx-item-row">
                                                    <span className="mbx-item-from">{isSentFolder ? `Para: ${who(m.to)}` : who(m.from)}</span>
                                                    <span className="mbx-item-date">{formatListDate(m.date)}</span>
                                                </div>
                                                <div className="mbx-item-row">
                                                    <span className="mbx-item-subject">{m.subject}</span>
                                                    <span className="mbx-item-icons">
                                                        {m.answered && <Reply size={13} />}
                                                        {m.hasAttachments && <Paperclip size={13} />}
                                                        <button type="button" className={`mbx-star${m.flagged ? ' is-on' : ''}`} aria-label="Estrela"
                                                            onClick={(e) => { e.stopPropagation(); act(m.flagged ? 'unflag' : 'flag', [m.uid]); }}>
                                                            <Star size={14} />
                                                        </button>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        {hasMore && (
                            <div ref={sentinel} className="mbx-empty">
                                {listLoading ? <Loader2 size={16} className="mbx-spin" /> : (
                                    <button type="button" className="mbx-link" onClick={() => loadPage(pagesLoaded + 1, 'append')}>Carregar mais</button>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Leitura */}
                <section className="mbx-reader">
                    {!openUid && (
                        <div className="mbx-empty mbx-empty--big">
                            <MailOpen size={30} />
                            <span>Escolha uma mensagem para ler.</span>
                            <small>Atalhos: <kbd>j</kbd> <kbd>k</kbd> para navegar, <kbd>r</kbd> para responder, <kbd>?</kbd> para ver todos.</small>
                        </div>
                    )}
                    {openUid && (
                        <>
                            <div className="mbx-toolbar">
                                <button type="button" className="mbx-icon mbx-back" title="Voltar" onClick={closeMessage}><ArrowLeft size={18} /></button>
                                <ToolButton icon={Reply} label="Responder" onClick={() => reply('reply')} disabled={!message} />
                                <ToolButton icon={ReplyAll} label="Responder a todos" onClick={() => reply('all')} disabled={!message} />
                                <ToolButton icon={Forward} label="Reencaminhar" onClick={() => reply('forward')} disabled={!message} />
                                <span className="mbx-toolbar-gap" />
                                {message && (
                                    <>
                                        <button type="button" className="mbx-icon" title={message.flagged ? 'Tirar estrela (s)' : 'Estrela (s)'} onClick={() => act(message.flagged ? 'unflag' : 'flag', [message.uid])}>
                                            <Star size={17} {...(message.flagged ? { fill: '#f59e0b', color: '#f59e0b' } : {})} />
                                        </button>
                                        <button type="button" className="mbx-icon" title="Marcar como não lida (u)" onClick={() => act('unseen', [message.uid])}><Mail size={17} /></button>
                                        {moveTargets.length > 0 && <MoveMenu folders={moveTargets} onMove={(path) => act('move', [message.uid], path)} />}
                                        <button type="button" className="mbx-icon mbx-danger" title={inTrash ? 'Apagar de vez' : 'Apagar (#)'}
                                            onClick={() => confirmTrash(1) && act('trash', [message.uid])}>
                                            <Trash2 size={17} />
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="mbx-reader-scroll">
                                {!message && messageLoading && (
                                    <div className="mbx-header">
                                        <div className="mbx-skeleton" style={{ height: 24, width: '60%' }} />
                                        <div className="mbx-skeleton" style={{ height: 14, width: '40%' }} />
                                        <div className="mbx-skeleton" style={{ height: 160 }} />
                                    </div>
                                )}
                                {message && (
                                    <>
                                        <header className="mbx-header">
                                            <h2>{message.subject}</h2>
                                            <div className="mbx-sender">
                                                <span className="mbx-avatar mbx-avatar--lg" style={{ background: avatarColor(message.from[0]) }}><span>{initials(message.from[0])}</span></span>
                                                <div className="mbx-sender-text">
                                                    <div className="mbx-sender-line">
                                                        <strong>{message.from[0]?.name || message.from[0]?.address}</strong>
                                                        {message.from[0]?.name && <span>&lt;{message.from[0].address}&gt;</span>}
                                                        <time>{formatFullDate(message.date)}</time>
                                                    </div>
                                                    <div className="mbx-sender-to">
                                                        Para: {message.to.map(fullAddress).join(', ') || '—'}
                                                        {message.cc.length > 0 && <> · Cc: {message.cc.map(fullAddress).join(', ')}</>}
                                                    </div>
                                                </div>
                                            </div>
                                            {message.attachments.length > 0 && (
                                                <div className="mbx-attachments">
                                                    {message.attachments.map((att) => (
                                                        <button key={att.index} type="button" onClick={() => downloadAttachment(att.index, att.filename)}>
                                                            <Paperclip size={13} /> <span>{att.filename}</span> <small>{formatSize(att.size)}</small>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </header>
                                        <MessageBody html={message.html} />
                                        <div className="mbx-quick-reply">
                                            <button type="button" className="mbx-tool" onClick={() => reply('reply')}><Reply size={15} /> Responder</button>
                                            <button type="button" className="mbx-tool" onClick={() => reply('forward')}><Forward size={15} /> Reencaminhar</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>

            {draft && (
                <Composer
                    key={composerKey}
                    draft={draft}
                    from={address}
                    recent={recentAddresses}
                    restored={draftRestored}
                    onClose={() => setDraft(null)}
                    onSend={queueSend}
                    onError={handleError}
                />
            )}

            {helpOpen && (
                <div className="mbx-overlay mbx-overlay--center" onClick={() => setHelpOpen(false)}>
                    <div className="mbx-help" onClick={(e) => e.stopPropagation()}>
                        <div className="mbx-help-head"><strong>Atalhos de teclado</strong><button type="button" className="mbx-icon" onClick={() => setHelpOpen(false)} aria-label="Fechar"><X size={16} /></button></div>
                        <dl>{SHORTCUTS.map(([key, label]) => <div key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></div>)}</dl>
                    </div>
                </div>
            )}

            <style>{STYLES}</style>
        </div>
    );
}

function TopBar({ address, children }: { address: string | null; children?: React.ReactNode }) {
    return (
        <header className="mbx-top">
            <Link href="/admin/dashboard" className="mbx-top-back" title="Voltar ao admin"><ArrowLeft size={17} /><span>Admin</span></Link>
            <div className="mbx-top-title">
                <strong>Email geral</strong>
                {address && <span>{address}</span>}
            </div>
            {children}
        </header>
    );
}

function ToolButton({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
    return (
        <button type="button" className="mbx-tool" onClick={onClick} disabled={disabled}>
            <Icon size={15} /> <span>{label}</span>
        </button>
    );
}

function MoveMenu({ folders, onMove }: { folders: Folder[]; onMove: (path: string) => void }) {
    return (
        <label className="mbx-icon mbx-move" title="Mover para…">
            <FolderInput size={17} />
            <select value="" onChange={(e) => e.target.value && onMove(e.target.value)} aria-label="Mover para">
                <option value="">Mover para…</option>
                {folders.map((f) => <option key={f.path} value={f.path}>{f.name}</option>)}
            </select>
        </label>
    );
}

/**
 * O HTML do email num iframe sem scripts (já vem limpo do servidor). Com
 * allow-same-origin dá para medir a altura e deixar a página toda fazer
 * scroll, em vez de uma caixa com scroll dentro de outra.
 */
function MessageBody({ html }: { html: string }) {
    const frame = useRef<HTMLIFrameElement>(null);
    const [height, setHeight] = useState(240);

    const srcDoc = useMemo(() => `<base target="_blank"><style>
        html,body{margin:0}
        body{padding:20px 24px 28px;font:14.5px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;overflow-wrap:anywhere;overflow-x:auto}
        img{max-width:100%;height:auto}
        a{color:#0f4c81}
        blockquote{margin:8px 0 8px 4px;padding-left:12px;border-left:3px solid #e2e8f0;color:#475569}
        pre{white-space:pre-wrap}
    </style>${html}`, [html]);

    useEffect(() => {
        const iframe = frame.current;
        if (!iframe) return;
        let observer: ResizeObserver | null = null;
        const measure = () => {
            const doc = iframe.contentDocument;
            if (doc?.documentElement) setHeight(Math.max(120, doc.documentElement.scrollHeight));
        };
        const onLoad = () => {
            measure();
            const doc = iframe.contentDocument;
            if (doc?.body) {
                observer = new ResizeObserver(measure);
                observer.observe(doc.body);
                // Imagens que chegam depois mudam a altura.
                doc.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure));
            }
        };
        iframe.addEventListener('load', onLoad);
        return () => {
            iframe.removeEventListener('load', onLoad);
            observer?.disconnect();
        };
    }, [srcDoc]);

    return (
        <iframe
            ref={frame}
            className="mbx-body"
            title="Conteúdo da mensagem"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            srcDoc={srcDoc}
            style={{ height }}
        />
    );
}

function NotConfiguredCard({ message }: { message: string }) {
    return (
        <div style={{ maxWidth: 640, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, display: 'grid', gap: 12 }}>
            <strong style={{ fontSize: 16 }}>Não foi possível ligar à caixa de email</strong>
            <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>{message}</p>
            <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>No Railway (ou no .env.local), confirme estas variáveis:</p>
            <pre style={{ margin: 0, background: '#f8fafc', borderRadius: 10, padding: 14, fontSize: 13, overflowX: 'auto' }}>{`MAILBOX_USER=geral@apostoladodegarabandal.com
MAILBOX_PASSWORD=…palavra-passe da caixa…
# opcionais (por omissão, Webnode)
MAILBOX_IMAP_HOST=imap.mail.webnode.com
MAILBOX_SMTP_HOST=smtp.mail.webnode.com`}</pre>
        </div>
    );
}

const STYLES = `
.mbx-page{position:fixed;inset:0;display:flex;flex-direction:column;background:#f4f6fa;font-family:var(--font-admin-sans),-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;z-index:40}
.mbx-top{display:flex;align-items:center;gap:14px;height:60px;padding:0 16px;background:#fff;border-bottom:1px solid #e6eaf0;flex-shrink:0}
.mbx-top-back{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:10px;color:#475569;font-size:13px;font-weight:600;text-decoration:none}
.mbx-top-back:hover{background:#f1f5f9;color:#0f172a}
.mbx-top-title{display:flex;flex-direction:column;line-height:1.2;min-width:0;width:200px;flex-shrink:0}
.mbx-top-title strong{font-size:15px}
.mbx-top-title span{font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mbx-search{flex:1;max-width:680px;display:flex;align-items:center;gap:10px;background:#eef2f7;border:1px solid transparent;border-radius:12px;padding:0 14px;color:#64748b;transition:background .15s,border-color .15s}
.mbx-search:focus-within{background:#fff;border-color:#cbd5e1;box-shadow:0 1px 6px rgba(15,23,42,.08)}
.mbx-search input{flex:1;border:0;outline:0;padding:11px 0;font-size:14px;color:#0f172a;background:transparent;min-width:0}
.mbx-search button{border:0;background:transparent;color:#94a3b8;cursor:pointer;display:flex}
.mbx-icon.mbx-menu{display:none}
.mbx{flex:1;min-height:0;display:grid;grid-template-columns:232px minmax(320px,420px) 1fr}
.mbx-folders{padding:14px 12px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;min-height:0}
.mbx-folders nav{display:grid;gap:2px;margin-top:10px}
.mbx-primary,.mbx-secondary{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border-radius:14px;font-size:13.5px;font-weight:700;cursor:pointer;transition:filter .15s,background .15s}
.mbx-primary{background:#0f4c81;color:#fff;border:0;box-shadow:0 2px 8px rgba(15,76,129,.25)}
.mbx-primary:hover{filter:brightness(1.1)}
.mbx-primary:disabled{opacity:.6;cursor:default}
.mbx-secondary{background:#fff;color:#0f4c81;border:1px solid #d7dee8}
.mbx-secondary:hover{background:#f8fafc}
.mbx-folder{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:999px;border:0;background:transparent;font-size:13.5px;color:#334155;cursor:pointer;text-align:left}
.mbx-folder:hover{background:#e8edf4}
.mbx-folder.is-active{background:#dbe7f4;color:#0f4c81;font-weight:700}
.mbx-folder-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mbx-count{font-size:11.5px;font-weight:700;color:#0f4c81}
.mbx-folder.is-active .mbx-count{color:#0f4c81}
.mbx-scrim{display:none}
.mbx-list{display:flex;flex-direction:column;min-width:0;min-height:0;background:#fff;border-left:1px solid #e6eaf0;border-right:1px solid #e6eaf0}
.mbx-list-head{padding:8px 10px 8px 16px;border-bottom:1px solid #eef2f7;min-height:52px;display:flex;align-items:center}
.mbx-list-tools,.mbx-bulk{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%}
.mbx-list-title{display:flex;align-items:baseline;gap:8px;min-width:0}
.mbx-list-title strong{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mbx-list-title span{font-size:12px;color:#94a3b8}
.mbx-pill{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:600;color:#475569;cursor:pointer}
.mbx-pill.is-on{background:#0f4c81;border-color:#0f4c81;color:#fff}
.mbx-items{flex:1;overflow-y:auto;overscroll-behavior:contain;min-height:0}
.mbx-day{position:sticky;top:0;z-index:1;background:rgba(255,255,255,.95);backdrop-filter:blur(4px);padding:8px 16px 6px;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #f1f5f9}
.mbx-item{display:flex;gap:12px;align-items:flex-start;padding:11px 14px 11px 13px;border-bottom:1px solid #f1f5f9;cursor:pointer;border-left:3px solid transparent}
.mbx-item:hover{background:#f8fafc}
.mbx-item.is-open{background:#eaf2fb;border-left-color:#0f4c81}
.mbx-item.is-selected{background:#eef4fb}
.mbx-avatar{flex-shrink:0;width:36px;height:36px;border-radius:50%;border:0;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;cursor:pointer;letter-spacing:.02em}
.mbx-avatar--lg{width:42px;height:42px;font-size:14px;cursor:default}
.mbx-item-main{flex:1;min-width:0;display:grid;gap:3px}
.mbx-item-row{display:flex;align-items:center;gap:8px;min-width:0}
.mbx-item-from{flex:1;font-size:13.5px;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mbx-item-date{font-size:12px;color:#94a3b8;flex-shrink:0}
.mbx-item-subject{flex:1;font-size:13px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mbx-item-icons{display:inline-flex;align-items:center;gap:5px;color:#94a3b8;flex-shrink:0}
.mbx-star{border:0;background:transparent;padding:0;display:flex;color:#cbd5e1;cursor:pointer;opacity:0;transition:opacity .1s}
.mbx-item:hover .mbx-star,.mbx-star.is-on{opacity:1}
.mbx-star.is-on{color:#f59e0b}
.mbx-star.is-on svg{fill:#f59e0b}
.mbx-item.is-unseen .mbx-item-from{font-weight:800;color:#0f172a}
.mbx-item.is-unseen .mbx-item-subject{color:#0f172a;font-weight:600}
.mbx-item.is-unseen .mbx-item-date{color:#0f4c81;font-weight:700}
.mbx-icon{position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;border:0;background:transparent;color:#475569;cursor:pointer;flex-shrink:0}
.mbx-icon:hover{background:#f1f5f9;color:#0f172a}
.mbx-icon:disabled{opacity:.35;cursor:default}
.mbx-danger:hover{color:#b91c1c;background:#fee2e2}
.mbx-move select{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}
.mbx-reader{display:flex;flex-direction:column;min-width:0;min-height:0;background:#fff}
.mbx-toolbar{display:flex;align-items:center;gap:6px;padding:8px 14px;border-bottom:1px solid #eef2f7;min-height:52px;flex-shrink:0}
.mbx-toolbar-gap{flex:1}
.mbx-icon.mbx-back{display:none}
.mbx-tool{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;border:1px solid #e2e8f0;background:#fff;font-size:13px;font-weight:600;color:#334155;cursor:pointer}
.mbx-tool:hover{border-color:#0f4c81;color:#0f4c81}
.mbx-tool:disabled{opacity:.5;cursor:default}
.mbx-reader-scroll{flex:1;overflow-y:auto;min-height:0;overscroll-behavior:contain}
.mbx-header{padding:22px 24px 14px;display:grid;gap:14px;border-bottom:1px solid #f1f5f9}
.mbx-header h2{margin:0;font-size:21px;color:#0f172a;line-height:1.3;font-weight:700;overflow-wrap:anywhere}
.mbx-sender{display:flex;gap:12px;align-items:center;min-width:0}
.mbx-sender-text{min-width:0;flex:1;display:grid;gap:2px}
.mbx-sender-line{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;font-size:14px}
.mbx-sender-line span{color:#64748b;font-size:13px}
.mbx-sender-line time{margin-left:auto;color:#94a3b8;font-size:12.5px}
.mbx-sender-to{font-size:12.5px;color:#64748b;overflow-wrap:anywhere}
.mbx-attachments{display:flex;flex-wrap:wrap;gap:8px}
.mbx-attachments button{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12.5px;color:#334155;cursor:pointer;max-width:100%}
.mbx-attachments small{color:#94a3b8;flex-shrink:0}
.mbx-attachments button:hover{border-color:#0f4c81;color:#0f4c81}
.mbx-attachments span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
.mbx-body{display:block;width:100%;border:0;background:#fff}
.mbx-quick-reply{display:flex;gap:8px;padding:8px 24px 32px}
.mbx-empty{display:flex;align-items:center;justify-content:center;gap:10px;padding:20px 16px;color:#94a3b8;font-size:13.5px}
.mbx-empty--big{flex-direction:column;flex:1;text-align:center;padding:60px 24px}
.mbx-empty--big small{color:#94a3b8;font-size:12.5px}
kbd{display:inline-block;min-width:18px;padding:1px 6px;border:1px solid #e2e8f0;border-bottom-width:2px;border-radius:6px;background:#fff;font:600 11.5px/1.5 var(--font-geist-mono),ui-monospace,monospace;color:#334155;text-align:center}
.mbx-skeleton{border-radius:10px;background:linear-gradient(90deg,#eef2f7 25%,#f6f8fb 50%,#eef2f7 75%);background-size:200% 100%;animation:mbx-shimmer 1.2s infinite}
.mbx-skeleton--row{height:52px;margin:10px 14px}
@keyframes mbx-shimmer{to{background-position:-200% 0}}
.mbx-overlay{position:fixed;inset:0;background:rgba(15,23,42,.35);display:flex;padding:20px;z-index:60}
.mbx-overlay--center{align-items:center;justify-content:center}
.mbx-link{border:0;background:transparent;color:#0f4c81;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.mbx-help{width:min(440px,100%);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 64px rgba(15,23,42,.28)}
.mbx-help-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #eef2f7;background:#f8fafc}
.mbx-help dl{margin:0;padding:12px 18px 18px;display:grid;gap:8px}
.mbx-help dl div{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13.5px}
.mbx-help dd{margin:0;color:#475569}
.mbx-spin{animation:mbx-spin .8s linear infinite}
@keyframes mbx-spin{to{transform:rotate(360deg)}}
@media (max-width:1180px){.mbx{grid-template-columns:200px minmax(280px,360px) 1fr}.mbx-tool span{display:none}.mbx-top-title{width:auto}}
@media (max-width:900px){
  .mbx{grid-template-columns:1fr}
  .mbx-icon.mbx-menu{display:inline-flex}
  .mbx-top{gap:8px;padding:0 10px}
  .mbx-top-back span,.mbx-top-title{display:none}
  .mbx-folders{position:fixed;top:60px;bottom:0;left:0;width:260px;background:#f4f6fa;z-index:30;transform:translateX(-100%);transition:transform .2s}
  .mbx-folders.is-open{transform:none;box-shadow:4px 0 24px rgba(15,23,42,.15)}
  .mbx-scrim{display:block;position:fixed;inset:60px 0 0 0;background:rgba(15,23,42,.3);z-index:20}
  .mbx-list{border:0}
  .mbx-reader{display:none}
  .mbx--reading .mbx-list{display:none}
  .mbx--reading .mbx-reader{display:flex}
  .mbx-icon.mbx-back{display:inline-flex}
  .mbx-header{padding:16px}
  .mbx-quick-reply{padding:8px 16px 24px}
}
`;
