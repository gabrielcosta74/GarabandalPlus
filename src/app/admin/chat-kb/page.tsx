"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import AdminShell from '../AdminShell';
import { FileText, MessageSquare, Save, RefreshCw, ChevronRight, ChevronDown, Bot, User } from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
type KbFile = { filename: string; content: string };
type ChatMsg = { role: 'user' | 'assistant'; content: string };
type Conversation = {
    id: string;
    session_id: string;
    pilgrimage_slug: string | null;
    pilgrimage_title: string | null;
    messages: ChatMsg[];
    created_at: string;
    updated_at: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
async function getToken() {
    const { data } = await supabaseBrowser!.auth.getSession();
    return data.session?.access_token || '';
}

function authHeaders(token: string) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function prettyDate(iso: string) {
    return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ────────────────────────────────────────────────────────────────────────────
// KB Editor Tab
// ────────────────────────────────────────────────────────────────────────────
function KbEditorTab() {
    const [files, setFiles] = useState<KbFile[]>([]);
    const [activeFile, setActiveFile] = useState<string>('');
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const token = await getToken();
        const res = await fetch('/api/admin/chat-kb', { headers: authHeaders(token) });
        const data = await res.json();
        if (data.files) {
            setFiles(data.files);
            if (!activeFile && data.files.length > 0) {
                setActiveFile(data.files[0].filename);
                setDraft(data.files[0].content);
            }
        }
        setLoading(false);
    }, [activeFile]);

    useEffect(() => { load(); }, []);

    const selectFile = (f: KbFile) => {
        setActiveFile(f.filename);
        setDraft(f.content);
        setSaved(false);
    };

    const save = async () => {
        setSaving(true);
        const token = await getToken();
        await fetch('/api/admin/chat-kb', {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({ filename: activeFile, content: draft }),
        });
        // Update local state
        setFiles(prev => prev.map(f => f.filename === activeFile ? { ...f, content: draft } : f));
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const fileName = (f: string) => {
        const labels: Record<string, string> = {
            '00-sobre.md': 'Sobre o Apostolado',
            '01-inscricao.md': 'Processo de Inscrição',
            '02-pagamentos.md': 'Pagamentos',
            '03-cancelamento.md': 'Cancelamento',
            '04-documentos.md': 'Documentos',
            '05-logistica.md': 'Logística',
            '06-espiritual.md': 'Espiritual',
            '07-garabandal.md': 'Garabandal',
            '08-faq.md': 'FAQ',
        };
        return labels[f] || f;
    };

    if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">A carregar...</div>;

    return (
        <div className="flex gap-4 h-[calc(100vh-240px)] min-h-[400px]">
            {/* Sidebar */}
            <div className="w-52 shrink-0 bg-white rounded-xl border border-slate-200 overflow-y-auto">
                <div className="p-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">Ficheiros KB</div>
                {files.map(f => (
                    <button
                        key={f.filename}
                        onClick={() => selectFile(f)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                            activeFile === f.filename
                                ? 'bg-yellow-50 text-yellow-800 font-semibold border-l-2 border-yellow-400'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{fileName(f.filename)}</span>
                    </button>
                ))}
            </div>

            {/* Editor */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800">{fileName(activeFile)}</h3>
                        <p className="text-xs text-slate-400 font-mono">{activeFile}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {saved && <span className="text-xs text-green-600 font-semibold">Guardado ✓</span>}
                        <button
                            onClick={save}
                            disabled={saving || !activeFile}
                            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                        >
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'A guardar...' : 'Guardar'}
                        </button>
                    </div>
                </div>
                <textarea
                    value={draft}
                    onChange={e => { setDraft(e.target.value); setSaved(false); }}
                    className="flex-1 font-mono text-sm bg-white border border-slate-200 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 text-slate-700 leading-relaxed"
                    spellCheck={false}
                />
                <p className="text-xs text-slate-400">Markdown suportado. Após guardar, o assistente usa a nova versão nas próximas mensagens (reinicia o servidor em dev para aplicar o cache reset).</p>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Conversations Tab
// ────────────────────────────────────────────────────────────────────────────
function ConversationRow({ conv }: { conv: Conversation }) {
    const [open, setOpen] = useState(false);
    const userMsgs = conv.messages.filter(m => m.role === 'user').length;
    const preview = conv.messages.find(m => m.role === 'user')?.content?.slice(0, 80) || '—';

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
                            {conv.pilgrimage_slug || 'sem slug'}
                        </span>
                        <span className="text-xs text-slate-400">{userMsgs} pergunta{userMsgs !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-sm text-slate-600 truncate">"{preview}"</p>
                    <p className="text-xs text-slate-400 mt-0.5">{prettyDate(conv.updated_at)}</p>
                </div>
                {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>

            {open && (
                <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
                    {conv.messages.map((msg, i) => (
                        <div key={i} className={`flex gap-2 max-w-[90%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-yellow-400' : 'bg-white border border-slate-200'}`}>
                                {msg.role === 'user'
                                    ? <User className="w-3.5 h-3.5 text-slate-800" />
                                    : <Bot className="w-3.5 h-3.5 text-slate-500" />}
                            </div>
                            <div className={`text-xs rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap ${
                                msg.role === 'user' ? 'bg-yellow-400 text-slate-900' : 'bg-white text-slate-700 border border-slate-100'
                            }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ConversationsTab() {
    const [convs, setConvs] = useState<Conversation[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (p = 1) => {
        setLoading(true);
        const token = await getToken();
        const res = await fetch(`/api/admin/chat-conversations?page=${p}`, { headers: authHeaders(token) });
        const data = await res.json();
        setConvs(data.conversations || []);
        setTotal(data.total || 0);
        setPage(p);
        setLoading(false);
    }, []);

    useEffect(() => { load(1); }, [load]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{total} conversa{total !== 1 ? 's' : ''} no total</p>
                <button onClick={() => load(page)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
                    <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                </button>
            </div>

            {loading
                ? <div className="text-center py-16 text-slate-400">A carregar conversas...</div>
                : convs.length === 0
                    ? <div className="text-center py-16 text-slate-400">Sem conversas ainda.</div>
                    : <div className="space-y-2">
                        {convs.map(c => <ConversationRow key={c.id} conv={c} />)}
                    </div>
            }

            {total > 30 && (
                <div className="flex justify-center gap-2 pt-2">
                    <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50">← Anterior</button>
                    <span className="px-3 py-1.5 text-sm text-slate-500">Pág {page}</span>
                    <button disabled={page * 30 >= total} onClick={() => load(page + 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50">Seguinte →</button>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────────────
export default function ChatKbAdminPage() {
    const [tab, setTab] = useState<'kb' | 'conversations'>('kb');

    return (
        <AdminShell title="Chat IA — Base de Conhecimento" description="Edita os ficheiros de conhecimento do assistente e consulta as conversas dos peregrinos.">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setTab('kb')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'kb' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FileText className="w-4 h-4" /> Base de Conhecimento
                    </button>
                    <button
                        onClick={() => setTab('conversations')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'conversations' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <MessageSquare className="w-4 h-4" /> Conversas
                    </button>
                </div>

                {tab === 'kb' ? <KbEditorTab /> : <ConversationsTab />}
            </div>
        </AdminShell>
    );
}
