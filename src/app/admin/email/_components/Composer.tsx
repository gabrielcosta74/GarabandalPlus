"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Eye, Maximize2, Minimize2, Minus, MoreHorizontal, Paperclip, PenLine, Send, Trash2, Users, X } from 'lucide-react';
import MailEditor, { type MailEditorHandle } from './MailEditor';
import RecipientInput from './RecipientInput';
import { api, formatSize, isValidEmail, type Address, type Draft, type FileDraft, type Group } from './mail-api';
import { clearAutosave, isHtmlEmpty, loadBranded, loadSignatureSettings, saveAutosave, saveBranded, saveSignatureSettings } from './email-html';
import { DEFAULT_SIGNATURE, buildEmail, signatureHtml, type SignatureSettings } from './email-template';
import './composer.css';

const MAX_ATTACHMENTS = 15 * 1024 * 1024;

const readFile = (file: globalThis.File) => new Promise<FileDraft>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        content: String(reader.result).split(',')[1] || '',
        size: file.size,
    });
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.readAsDataURL(file);
});

type Mode = 'normal' | 'min' | 'max';

export default function Composer({ draft: initial, from, recent, restored, onClose, onSend, onError }: {
    draft: Draft;
    from: string | null;
    recent: Address[];
    restored?: boolean;
    onClose: () => void;
    /** Já validado; a página trata do envio (e do "Anular"). */
    onSend: (draft: Draft) => void;
    onError: (error: unknown) => void;
}) {
    const [draft, setDraft] = useState<Draft>(initial);
    const [files, setFiles] = useState<FileDraft[]>(initial.files || []);
    const [mode, setMode] = useState<Mode>('normal');
    const [showCopies, setShowCopies] = useState(initial.cc.length > 0 || initial.bcc.length > 0);
    const [groups, setGroups] = useState<Group[] | null>(null);
    const [preview, setPreview] = useState<{ email: string; name: string | null }[] | null>(null);
    const [dragging, setDragging] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(restored ? Date.now() : null);
    const [signatureOpen, setSignatureOpen] = useState(false);
    const [signature, setSignature] = useState<SignatureSettings>(() => loadSignatureSettings());
    const [showQuote, setShowQuote] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const branded = draft.branded ?? loadBranded();
    const editorRef = useRef<MailEditorHandle>(null);
    const subjectRef = useRef<HTMLInputElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const isGroup = draft.mode === 'group';
    const isReply = Boolean(initial.inReplyTo);

    const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

    useEffect(() => {
        if (!isGroup) return;
        api({ view: 'groups' }).then((data) => setGroups(data.groups)).catch(onError);
    }, [isGroup, onError]);

    // Respostas: o cursor começa no texto, por cima da citação.
    useEffect(() => {
        if (!isReply) return;
        const timer = setTimeout(() => editorRef.current?.focus('start'), 60);
        return () => clearTimeout(timer);
    }, [isReply]);

    // Rascunho guardado neste browser a cada pausa na escrita.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isHtmlEmpty(draft.html) && !draft.subject && !draft.to.length) return;
            saveAutosave(draft);
            setSavedAt(Date.now());
        }, 600);
        return () => clearTimeout(timer);
    }, [draft]);

    const group = useMemo(() => groups?.find((g) => g.id === draft.groupId) || null, [groups, draft.groupId]);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const dirty = draft.html !== initial.html || draft.subject !== initial.subject || draft.to.length !== initial.to.length || files.length > (initial.files?.length || 0);

    const addFiles = async (list: FileList | File[] | null) => {
        if (!list || !list.length) return;
        try {
            const added = await Promise.all([...list].map(readFile));
            const next = [...files, ...added];
            if (next.reduce((sum, f) => sum + f.size, 0) > MAX_ATTACHMENTS) throw new Error('Os anexos passam dos 15 MB.');
            setFiles(next);
        } catch (error) {
            onError(error);
        }
    };

    const discard = () => {
        if (dirty && !window.confirm('Descartar esta mensagem?')) return;
        clearAutosave();
        onClose();
    };

    const send = () => {
        // O editor é a fonte de verdade: o estado pode ainda não ter a última tecla.
        const html = editorRef.current?.editor?.getHTML() ?? draft.html;
        if (isGroup && !group) return toast.error('Escolha um grupo.');
        if (!isGroup) {
            if (!draft.to.length) return toast.error('Indique pelo menos um destinatário.');
            const invalid = [...draft.to, ...draft.cc, ...draft.bcc].find((a) => !isValidEmail(a.address));
            if (invalid) return toast.error(`"${invalid.address}" não é um email válido.`);
        }
        if (!draft.subject.trim()) {
            toast.error('Falta o assunto.');
            setMode((m) => (m === 'min' ? 'normal' : m));
            setTimeout(() => subjectRef.current?.focus(), 0);
            return;
        }
        if (isHtmlEmpty(html)) return toast.error('A mensagem está vazia.');
        if (isGroup && !window.confirm(`Enviar "${draft.subject}" para ${group!.count} pessoas (${group!.label})?\n\nCada pessoa recebe o seu próprio email.`)) return;
        onSend({ ...draft, html, files, branded });
    };

    // ⌘/Ctrl+Enter envia; Esc minimiza (não apaga nada).
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                send();
            } else if (event.key === 'Escape' && !signatureOpen && !previewOpen && mode !== 'min') {
                setMode('min');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const title = isGroup ? 'Escrever a um grupo' : isReply ? 'Responder' : 'Nova mensagem';

    if (mode === 'min') {
        return (
            <div className="mbx-c-min" role="button" tabIndex={0} onClick={() => setMode('normal')} onKeyDown={(e) => e.key === 'Enter' && setMode('normal')}>
                <span>{draft.subject || title}</span>
                <button type="button" aria-label="Maximizar" onClick={(e) => { e.stopPropagation(); setMode('max'); }}><Maximize2 size={14} /></button>
                <button type="button" aria-label="Fechar" onClick={(e) => { e.stopPropagation(); discard(); }}><X size={15} /></button>
            </div>
        );
    }

    return (
        <>
            {mode === 'max' && <div className="mbx-c-backdrop" onClick={() => setMode('normal')} />}
            <div className={`mbx-c mbx-c--${mode}${dragging ? ' is-dragging' : ''}`} role="dialog" aria-label={title}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
                onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); } }}>
                <div className="mbx-c-head" onDoubleClick={() => setMode(mode === 'max' ? 'normal' : 'max')}>
                    <strong>{title}</strong>
                    <div className="mbx-c-head-actions">
                        <button type="button" title="Minimizar (Esc)" onClick={() => setMode('min')}><Minus size={16} /></button>
                        <button type="button" title={mode === 'max' ? 'Reduzir' : 'Ecrã inteiro'} onClick={() => setMode(mode === 'max' ? 'normal' : 'max')}>
                            {mode === 'max' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                        <button type="button" title="Fechar" onClick={discard}><X size={16} /></button>
                    </div>
                </div>

                <div className="mbx-c-fields">
                    {from && <div className="mbx-c-field"><label>De</label><span className="mbx-c-from">Apostolado de Garabandal &lt;{from}&gt;</span></div>}
                    {isGroup ? (
                        <div className="mbx-c-field">
                            <label htmlFor="mbx-group"><Users size={14} /></label>
                            <select id="mbx-group" value={draft.groupId || ''} disabled={!groups} autoFocus
                                onChange={(e) => { set({ groupId: e.target.value }); setPreview(null); }}>
                                <option value="">{groups ? 'Escolha um grupo…' : 'A carregar grupos…'}</option>
                                {groups?.map((g) => (
                                    <option key={g.id} value={g.id} disabled={!g.count}>{g.label} — {g.description} ({g.count})</option>
                                ))}
                            </select>
                            {draft.groupId && (
                                <button type="button" className="mbx-c-link" onClick={async () => {
                                    try { setPreview((await api({ view: 'group', id: draft.groupId! })).recipients); } catch (error) { onError(error); }
                                }}>Ver lista</button>
                            )}
                        </div>
                    ) : (
                        <>
                            <RecipientInput id="mbx-to" label="Para" value={draft.to} onChange={(to) => set({ to })} recent={recent} autoFocus={!isReply && !initial.to.length}
                                trailing={!showCopies ? <button type="button" className="mbx-c-link" onClick={(e) => { e.stopPropagation(); setShowCopies(true); }}>Cc Bcc</button> : null} />
                            {showCopies && (
                                <>
                                    <RecipientInput id="mbx-cc" label="Cc" value={draft.cc} onChange={(cc) => set({ cc })} recent={recent} />
                                    <RecipientInput id="mbx-bcc" label="Bcc" value={draft.bcc} onChange={(bcc) => set({ bcc })} recent={recent} />
                                </>
                            )}
                        </>
                    )}
                    {preview && (
                        <div className="mbx-c-preview">
                            <div><strong>{preview.length} pessoas</strong><button type="button" className="mbx-c-link" onClick={() => setPreview(null)}>Fechar</button></div>
                            <ul>{preview.map((r) => <li key={r.email}>{r.name ? `${r.name} · ` : ''}{r.email}</li>)}</ul>
                        </div>
                    )}
                    <div className="mbx-c-field">
                        <input ref={subjectRef} className="mbx-c-subject" value={draft.subject} placeholder="Assunto" onChange={(e) => set({ subject: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus('start'); } }} />
                    </div>
                </div>

                <div className="mbx-c-body">
                    <MailEditor ref={editorRef} initialHtml={initial.html} onChange={(html) => set({ html })} footer={
                        <div className="mbx-c-extras">
                            {signature.enabled && signature.name.trim() ? (
                                <button type="button" className="mbx-c-sigpreview" title="Editar assinatura" onClick={() => setSignatureOpen(true)}
                                    dangerouslySetInnerHTML={{ __html: signatureHtml(signature, from, { logo: !branded }) }} />
                            ) : (
                                <button type="button" className="mbx-c-link" onClick={() => setSignatureOpen(true)}>+ Adicionar assinatura</button>
                            )}
                            {draft.quote && (
                                showQuote ? (
                                    <div className="mbx-c-quote">
                                        <div dangerouslySetInnerHTML={{ __html: draft.quote }} />
                                        <button type="button" className="mbx-c-link" onClick={() => set({ quote: undefined })}>Não incluir a mensagem original</button>
                                    </div>
                                ) : (
                                    <button type="button" className="mbx-c-dots" title="Mostrar a mensagem original" onClick={() => setShowQuote(true)}><MoreHorizontal size={16} /></button>
                                )
                            )}
                        </div>
                    } />
                    {files.length > 0 && (
                        <div className="mbx-c-files">
                            {files.map((f, i) => (
                                <span key={`${f.filename}-${i}`} className="mbx-c-file">
                                    <Paperclip size={13} /><span>{f.filename}</span><small>{formatSize(f.size)}</small>
                                    <button type="button" aria-label={`Tirar ${f.filename}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={12} /></button>
                                </span>
                            ))}
                            <span className="mbx-c-files-total">{formatSize(totalSize)} de 15 MB</span>
                        </div>
                    )}
                    {isGroup && (
                        <p className="mbx-c-note">Cada pessoa recebe o seu próprio email e as respostas chegam a esta caixa. Para newsletters e campanhas use a plataforma de marketing.</p>
                    )}
                    {dragging && <div className="mbx-c-drop"><Paperclip size={22} />Largue para anexar</div>}
                </div>

                <div className="mbx-c-foot">
                    <button type="button" className="mbx-c-send" onClick={send}>
                        <Send size={15} /> {isGroup && group ? `Enviar a ${group.count}` : 'Enviar'}
                    </button>
                    <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                    <button type="button" className="mbx-c-icon" title="Anexar ficheiros" onClick={() => fileInput.current?.click()}><Paperclip size={17} /></button>
                    <button type="button" className="mbx-c-icon" title="Assinatura" onClick={() => setSignatureOpen(true)}><PenLine size={17} /></button>
                    <button type="button" className="mbx-c-icon" title="Pré-visualizar como vai chegar" onClick={() => setPreviewOpen(true)}><Eye size={17} /></button>
                    <label className={`mbx-c-switch${branded ? ' is-on' : ''}`} title="Enviar dentro do cartão do Apostolado (logótipo e rodapé)">
                        <input type="checkbox" checked={branded} onChange={(e) => { set({ branded: e.target.checked }); saveBranded(e.target.checked); }} />
                        <i aria-hidden />
                        <span>Modelo Apostolado</span>
                    </label>
                    <span className="mbx-c-status">
                        {savedAt ? (restored && savedAt && !dirty ? 'Rascunho recuperado' : 'Rascunho guardado') : '⌘ + Enter para enviar'}
                    </span>
                    <button type="button" className="mbx-c-icon mbx-c-danger" title="Descartar" onClick={discard}><Trash2 size={17} /></button>
                </div>
            </div>

            {signatureOpen && (
                <SignatureDialog from={from} initial={signature} onClose={() => setSignatureOpen(false)}
                    onSave={(next) => { setSignature(next); saveSignatureSettings(next); setSignatureOpen(false); toast.success('Assinatura guardada.'); }} />
            )}
            {previewOpen && (
                <PreviewDialog onClose={() => setPreviewOpen(false)} subject={draft.subject}
                    html={buildEmail({ body: editorRef.current?.editor?.getHTML() ?? draft.html, quote: draft.quote, signature, from, branded })} />
            )}
        </>
    );
}

function SignatureDialog({ from, initial, onClose, onSave }: {
    from: string | null;
    initial: SignatureSettings;
    onClose: () => void;
    onSave: (settings: SignatureSettings) => void;
}) {
    const [sig, setSig] = useState(initial);
    const set = (patch: Partial<SignatureSettings>) => setSig((prev) => ({ ...prev, ...patch }));
    return (
        <div className="mbx-c-backdrop mbx-c-backdrop--top" onClick={onClose}>
            <div className="mbx-c-sig" onClick={(e) => e.stopPropagation()}>
                <div className="mbx-c-head"><strong>Assinatura</strong><div className="mbx-c-head-actions"><button type="button" onClick={onClose} aria-label="Fechar"><X size={16} /></button></div></div>
                <div className="mbx-c-sig-form">
                    <label className="mbx-c-toggle">
                        <input type="checkbox" checked={sig.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
                        Juntar a assinatura a todas as mensagens
                    </label>
                    <label>Nome<input value={sig.name} onChange={(e) => set({ name: e.target.value })} placeholder="Rui Costa" /></label>
                    <label>Por baixo do nome<input value={sig.role} onChange={(e) => set({ role: e.target.value })} placeholder="Apostolado de Garabandal" /></label>
                    <label><span>Telefone <small>(opcional)</small></span><input value={sig.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+351 …" inputMode="tel" /></label>
                    <label className="mbx-c-toggle">
                        <input type="checkbox" checked={sig.handwritten} onChange={(e) => set({ handwritten: e.target.checked })} />
                        Mostrar a assinatura manuscrita (a dos diplomas)
                    </label>
                </div>
                <div className="mbx-c-sig-preview">
                    <span>Pré-visualização</span>
                    <div dangerouslySetInnerHTML={{ __html: signatureHtml(sig, from) || '<em style="color:#94a3b8">Sem assinatura</em>' }} />
                </div>
                <div className="mbx-c-foot">
                    <button type="button" className="mbx-c-send" onClick={() => onSave(sig)}>Guardar</button>
                    <button type="button" className="mbx-c-link" onClick={() => setSig(DEFAULT_SIGNATURE)}>Repor a original</button>
                    <span className="mbx-c-status">Fica guardada neste computador</span>
                </div>
            </div>
        </div>
    );
}

/** O email exatamente como vai sair, num iframe isolado. */
function PreviewDialog({ html, subject, onClose }: { html: string; subject: string; onClose: () => void }) {
    const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop');
    return (
        <div className="mbx-c-backdrop mbx-c-backdrop--top" onClick={onClose}>
            <div className="mbx-c-preview-box" onClick={(e) => e.stopPropagation()}>
                <div className="mbx-c-head">
                    <strong>{subject || '(sem assunto)'}</strong>
                    <div className="mbx-c-head-actions">
                        <button type="button" className={width === 'desktop' ? 'is-on' : ''} onClick={() => setWidth('desktop')}>Computador</button>
                        <button type="button" className={width === 'mobile' ? 'is-on' : ''} onClick={() => setWidth('mobile')}>Telemóvel</button>
                        <button type="button" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
                    </div>
                </div>
                <div className="mbx-c-preview-stage">
                    <iframe title="Pré-visualização" sandbox="" srcDoc={html} style={{ width: width === 'mobile' ? 375 : '100%' }} />
                </div>
            </div>
        </div>
    );
}
