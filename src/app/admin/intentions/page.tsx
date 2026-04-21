"use client";

import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
    Calendar,
    Printer,
    CheckCircle,
    Clock,
    Flame,
    User,
    Mail,
    AlertTriangle,
    Users,
    Trash2,
    Plus,
    ExternalLink,
} from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

type EnrichedIntention = {
    id: string;
    intention_text: string;
    candle_type: 'free' | 'donation';
    created_at: string;
    status: 'pending' | 'presented';
    amount?: number;
    user_name: string;
    user_email: string;
    user_id?: string;
};

type Manager = {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
};

type Tab = 'intentions' | 'managers';

async function getAdminToken(): Promise<string | null> {
    if (!supabaseBrowser) return null;
    const { data } = await supabaseBrowser.auth.getSession();
    return data.session?.access_token ?? null;
}

export default function AdminIntentionsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('intentions');

    // --- Intentions state ---
    const [intentions, setIntentions] = useState<EnrichedIntention[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [markingDone, setMarkingDone] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // --- Managers state ---
    const [managers, setManagers] = useState<Manager[]>([]);
    const [managersLoading, setManagersLoading] = useState(false);
    const [managersError, setManagersError] = useState<string | null>(null);
    const [addEmail, setAddEmail] = useState('');
    const [addName, setAddName] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    useEffect(() => {
        loadIntentions();
    }, [selectedMonth]);

    useEffect(() => {
        if (activeTab === 'managers') loadManagers();
    }, [activeTab]);

    // ------------------------------------------------------------------ //
    // Intentions
    // ------------------------------------------------------------------ //

    const loadIntentions = async () => {
        setLoading(true);
        setErrorMsg(null);
        if (!supabaseBrowser) { setLoading(false); return; }

        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

        try {
            const { data: rpcData, error: rpcError } = await supabaseBrowser
                .rpc('get_monthly_intentions', { start_date: startDate, end_date: endDate });

            if (!rpcError && rpcData) {
                setIntentions(rpcData as EnrichedIntention[]);
                setLoading(false);
                return;
            }

            let msg = rpcError?.message || 'Erro desconhecido';
            if (msg.includes('function') && msg.includes('does not exist')) {
                msg = 'Função de base de dados desatualizada. Por favor corra a migração novamente.';
            }
            setErrorMsg(`Erro de carregamento: ${msg}. Usando visualização básica.`);

            const { data: fallbackData, error: fallbackError } = await supabaseBrowser
                .from('prayer_intentions')
                .select('*')
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .order('created_at', { ascending: false });

            if (fallbackError) throw fallbackError;
            setIntentions((fallbackData ?? []).map(i => ({ ...i, user_name: 'Desconhecido', user_email: '' })));
        } catch (err: any) {
            setErrorMsg(err.message || 'Erro desconhecido');
            setIntentions([]);
        } finally {
            setLoading(false);
        }
    };

    const markAsPresented = async () => {
        const pending = intentions.filter(i => i.status === 'pending').map(i => i.id);
        if (pending.length === 0) return alert('Não há intenções pendentes para marcar.');
        if (!confirm(`Marcar ${pending.length} intenção(ões) como "Apresentada"?`)) return;

        setMarkingDone(true);
        try {
            const token = await getAdminToken();
            const res = await fetch('/api/prayer-portal/intentions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ids: pending }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Erro');
            await loadIntentions();
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        } finally {
            setMarkingDone(false);
        }
    };

    const handlePrintPDF = async () => {
        setGeneratingPdf(true);
        try {
            const pdfDoc = await PDFDocument.create();
            const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

            const margins = { top: 50, bottom: 50, left: 50, right: 50 };
            const pageSize = { width: 595.28, height: 841.89 };
            let page = pdfDoc.addPage([pageSize.width, pageSize.height]);
            let y = pageSize.height - margins.top;

            const checkPageBreak = (neededSpace: number) => {
                if (y - neededSpace < margins.bottom) {
                    page = pdfDoc.addPage([pageSize.width, pageSize.height]);
                    y = pageSize.height - margins.top;
                    drawHeader();
                }
            };

            const drawHeader = () => {
                page.drawText('Apostolado de Garabandal', { x: margins.left, y: pageSize.height - 40, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
                page.drawText('Livro de Intenções', { x: margins.left, y: pageSize.height - 65, size: 24, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
                const monthName = new Date(selectedMonth).toLocaleString('pt-PT', { month: 'long', year: 'numeric' });
                page.drawText(monthName.charAt(0).toUpperCase() + monthName.slice(1), { x: margins.left, y: pageSize.height - 85, size: 14, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
                page.drawLine({ start: { x: margins.left, y: pageSize.height - 100 }, end: { x: pageSize.width - margins.right, y: pageSize.height - 100 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
                if (y > pageSize.height - 100) y = pageSize.height - 110;
                else y -= 40;
            };

            drawHeader();
            y = pageSize.height - 120;

            for (const intention of intentions) {
                const words = intention.intention_text.split(' ');
                const maxWidth = pageSize.width - margins.left - margins.right - 20;
                const fontSize = 11;
                const lineHeight = 14;
                const lines: string[] = [];
                let currentLine = '';
                for (const word of words) {
                    const testLine = currentLine + (currentLine ? ' ' : '') + word;
                    if (fontRegular.widthOfTextAtSize(testLine, fontSize) > maxWidth) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine) lines.push(currentLine);

                const itemHeight = 40 + lines.length * lineHeight + 20;
                checkPageBreak(itemHeight);

                const date = new Date(intention.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                page.drawText(date, { x: margins.left, y, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
                page.drawText(intention.user_name || 'Anónimo', { x: margins.left + 50, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
                if (intention.candle_type === 'donation') {
                    const label = '(Donativo)';
                    page.drawText(label, { x: pageSize.width - margins.right - fontBold.widthOfTextAtSize(label, 9), y, size: 9, font: fontBold, color: rgb(0.8, 0.4, 0) });
                }
                y -= 15;
                if (intention.user_email) {
                    page.drawText(intention.user_email, { x: margins.left + 50, y: y + 3, size: 8, font: fontRegular, color: rgb(0.6, 0.6, 0.6) });
                    y -= 15;
                }
                for (const line of lines) {
                    page.drawText(line, { x: margins.left + 20, y, size: fontSize, font: fontItalic, color: rgb(0.2, 0.2, 0.2) });
                    y -= lineHeight;
                }
                y -= 10;
                page.drawLine({ start: { x: margins.left + 20, y }, end: { x: pageSize.width - margins.right - 20, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
                y -= 25;
            }

            const pages = pdfDoc.getPages();
            for (let i = 0; i < pages.length; i++) {
                const p = pages[i];
                const footerText = `Página ${i + 1} de ${pages.length} - Gerado em ${new Date().toLocaleDateString('pt-PT')}`;
                const textWidth = fontRegular.widthOfTextAtSize(footerText, 8);
                p.drawText(footerText, { x: (pageSize.width - textWidth) / 2, y: 20, size: 8, font: fontRegular, color: rgb(0.6, 0.6, 0.6) });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            window.open(URL.createObjectURL(blob), '_blank');
        } catch {
            alert('Erro ao gerar PDF');
        } finally {
            setGeneratingPdf(false);
        }
    };

    // ------------------------------------------------------------------ //
    // Managers
    // ------------------------------------------------------------------ //

    const loadManagers = async () => {
        setManagersLoading(true);
        setManagersError(null);
        try {
            const token = await getAdminToken();
            const res = await fetch('/api/prayer-portal/managers', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Erro');
            setManagers(json.managers);
        } catch (err: any) {
            setManagersError(err.message);
        } finally {
            setManagersLoading(false);
        }
    };

    const handleAddManager = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddLoading(true);
        setAddError(null);
        try {
            const token = await getAdminToken();
            const res = await fetch('/api/prayer-portal/managers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ email: addEmail, name: addName }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Erro');
            setAddEmail('');
            setAddName('');
            setManagers(prev => [json.manager, ...prev]);
        } catch (err: any) {
            setAddError(err.message);
        } finally {
            setAddLoading(false);
        }
    };

    const handleDeleteManager = async (id: string, email: string) => {
        if (!confirm(`Remover "${email}" dos gestores?`)) return;
        try {
            const token = await getAdminToken();
            const res = await fetch('/api/prayer-portal/managers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Erro');
            setManagers(prev => prev.filter(m => m.id !== id));
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        }
    };

    // ------------------------------------------------------------------ //
    // Render
    // ------------------------------------------------------------------ //

    return (
        <AdminLayout title="Gestão de Intenções">
            <div className="flex flex-col gap-6">

                {/* Tab Bar */}
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('intentions')}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'intentions' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Flame className="w-4 h-4" />
                        Intenções
                    </button>
                    <button
                        onClick={() => setActiveTab('managers')}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'managers' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users className="w-4 h-4" />
                        Gestores do Portal
                    </button>
                </div>

                {/* ---- Intentions Tab ---- */}
                {activeTab === 'intentions' && (
                    <>
                        {/* Controls */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selecionar Mês</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="month"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block" />
                                <div className="flex flex-col justify-center">
                                    <span className="text-2xl font-bold text-slate-900">{intentions.length}</span>
                                    <span className="text-xs text-slate-500">Intenções Totais</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePrintPDF}
                                    disabled={generatingPdf || intentions.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {generatingPdf ? <Clock className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                    Imprimir PDF
                                </button>
                                <button
                                    onClick={markAsPresented}
                                    disabled={markingDone || intentions.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    {markingDone ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    Marcar Feito
                                </button>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3 text-orange-800">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <div className="text-sm"><strong>Aviso:</strong> {errorMsg}</div>
                            </div>
                        )}

                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            {loading ? (
                                <div className="p-12 text-center text-slate-400">A carregar dados...</div>
                            ) : intentions.length === 0 ? (
                                <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                        <Flame className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p>Nenhuma intenção encontrada para este mês.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {intentions.map((intention) => (
                                        <div key={intention.id} className="p-6 hover:bg-slate-50 transition-colors">
                                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-slate-900 flex items-center gap-2">
                                                            <User className="w-4 h-4 text-slate-400" />
                                                            {intention.user_name}
                                                        </div>
                                                        {intention.candle_type === 'donation' && (
                                                            <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-200 uppercase tracking-wider">
                                                                Donativo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500 pl-6">
                                                        {intention.user_email && (
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="w-3 h-3" />
                                                                {intention.user_email}
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1 text-slate-400">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(intention.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${intention.status === 'presented' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {intention.status === 'presented' ? 'Apresentado' : 'Pendente'}
                                                </span>
                                            </div>
                                            <div className="pl-6 pt-2 border-l-2 border-slate-100">
                                                <p className="text-slate-700 leading-relaxed font-serif italic">
                                                    "{intention.intention_text}"
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ---- Managers Tab ---- */}
                {activeTab === 'managers' && (
                    <div className="flex flex-col gap-6">

                        {/* Info banner */}
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 text-blue-800 text-sm">
                            <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                                <strong>Portal de Orações</strong> — os gestores listados abaixo podem aceder ao portal externo em{' '}
                                <a href="/portal-oracoes" target="_blank" className="underline font-medium">/portal-oracoes</a>{' '}
                                para consultar, imprimir e gerir as intenções, sem acesso ao painel de administração.
                            </div>
                        </div>

                        {/* Add form */}
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                            <h3 className="font-semibold text-slate-900 mb-4">Adicionar Gestor</h3>
                            <form onSubmit={handleAddManager} className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="email"
                                    placeholder="Email do gestor"
                                    value={addEmail}
                                    onChange={e => setAddEmail(e.target.value)}
                                    required
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Nome (opcional)"
                                    value={addName}
                                    onChange={e => setAddName(e.target.value)}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={addLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors text-sm font-medium whitespace-nowrap"
                                >
                                    {addLoading ? <Clock className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Adicionar
                                </button>
                            </form>
                            {addError && (
                                <p className="mt-2 text-sm text-red-600">{addError}</p>
                            )}
                        </div>

                        {/* Managers list */}
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-semibold text-slate-900">Gestores Autorizados</h3>
                                <span className="text-xs text-slate-400">{managers.length} registo(s)</span>
                            </div>

                            {managersLoading ? (
                                <div className="p-10 text-center text-slate-400 text-sm">A carregar...</div>
                            ) : managersError ? (
                                <div className="p-10 text-center text-red-500 text-sm">{managersError}</div>
                            ) : managers.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                                        <Users className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="text-sm">Nenhum gestor adicionado ainda.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {managers.map(m => (
                                        <div key={m.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-slate-900 text-sm">{m.name || '—'}</span>
                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {m.email}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-slate-400">
                                                    {new Date(m.created_at).toLocaleDateString('pt-PT')}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteManager(m.id, m.email)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remover gestor"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
