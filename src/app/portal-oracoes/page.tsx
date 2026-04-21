"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabase-browser';
import {
    Calendar, Printer, CheckCircle, Flame, User, Mail,
    LogOut, Loader2, AlertTriangle, Search,
    Square, CheckSquare,
} from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

type Intention = {
    id: string;
    intention_text: string;
    candle_type: 'free' | 'donation';
    created_at: string;
    status: 'pending' | 'presented';
    amount?: number;
    user_name: string;
    user_email: string;
};

type StatusFilter = 'all' | 'pending' | 'presented';

export default function PortalPage() {
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    const [intentions, setIntentions] = useState<Intention[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Date Filtering
    const [periodType, setPeriodType] = useState<'month' | 'custom' | 'all'>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [markingDone, setMarkingDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [search, setSearch] = useState('');

    // Selection
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Auth guard
    useEffect(() => {
        (async () => {
            if (!supabaseBrowser) { router.replace('/portal-oracoes/login'); return; }
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) { router.replace('/portal-oracoes/login'); return; }

            const res = await fetch('/api/prayer-portal/auth', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!res.ok) {
                await supabaseBrowser.auth.signOut();
                router.replace('/portal-oracoes/login');
                return;
            }
            const json = await res.json();
            setToken(session.access_token);
            setUserEmail(json.user?.email ?? null);
            setAuthChecked(true);
        })();
    }, [router]);

    useEffect(() => {
        if (authChecked && token) loadIntentions();
    }, [authChecked, token, periodType, selectedMonth, startDate, endDate]);

    // Clear selection when filters change
    useEffect(() => { setSelected(new Set()); }, [periodType, selectedMonth, startDate, endDate, statusFilter]);

    const loadIntentions = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        setSelected(new Set());
        try {
            let url = `/api/prayer-portal/intentions?`;
            if (periodType === 'all') url += `all=true`;
            else if (periodType === 'custom') url += `start=${startDate}&end=${endDate}`;
            else url += `month=${selectedMonth}`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Erro');
            setIntentions(json.intentions ?? []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Derived lists
    const filtered = useMemo(() => {
        let list = intentions;
        if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(i =>
                i.intention_text.toLowerCase().includes(q) ||
                i.user_name.toLowerCase().includes(q) ||
                i.user_email.toLowerCase().includes(q)
            );
        }
        return list;
    }, [intentions, statusFilter, search]);

    const stats = useMemo(() => ({
        total: intentions.length,
        pending: intentions.filter(i => i.status === 'pending').length,
        presented: intentions.filter(i => i.status === 'presented').length,
        donations: intentions.filter(i => i.candle_type === 'donation').length,
    }), [intentions]);

    // Selection helpers
    const allVisibleSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id));
    const someSelected = selected.size > 0;

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAllVisible = () => {
        if (allVisibleSelected) {
            setSelected(prev => {
                const next = new Set(prev);
                filtered.forEach(i => next.delete(i.id));
                return next;
            });
        } else {
            setSelected(prev => {
                const next = new Set(prev);
                filtered.forEach(i => next.add(i.id));
                return next;
            });
        }
    };

    const selectAllPending = () => {
        const pendingIds = intentions.filter(i => i.status === 'pending').map(i => i.id);
        setSelected(new Set(pendingIds));
        if (statusFilter !== 'all') setStatusFilter('all');
    };

    // Actions operate on selected, or if none selected, on visible filtered
    const getTargetIntentions = () => {
        if (someSelected) return intentions.filter(i => selected.has(i.id));
        return filtered;
    };

    const handleMarkPresented = async () => {
        const targets = getTargetIntentions().filter(i => i.status === 'pending');
        if (targets.length === 0) return alert('Nenhuma intenção pendente seleccionada.');
        if (!confirm(`Marcar ${targets.length} intenção(ões) como "Apresentada"?`)) return;
        setMarkingDone(true);
        try {
            const res = await fetch('/api/prayer-portal/intentions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ids: targets.map(i => i.id) }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Erro');
            await loadIntentions();
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        } finally {
            setMarkingDone(false);
        }
    };

    const handleSignOut = async () => {
        if (!supabaseBrowser) return;
        await supabaseBrowser.auth.signOut();
        router.replace('/portal-oracoes/login');
    };

    // pdf-lib's StandardFonts use WinAnsi encoding. Anything outside it (emojis,
    // smart quotes, bullets, em dashes, etc.) throws at drawText. Normalize first.
    const sanitizeForPDF = (text: string) => {
        if (!text) return '';
        return text
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'")      // smart single quotes
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"')      // smart double quotes
            .replace(/[\u2013\u2014\u2015]/g, '-')            // en/em dashes
            .replace(/[\u2022\u25CF\u25A0\u25AA\u25CB]/g, '*') // bullets/shapes
            .replace(/\u2026/g, '...')                         // ellipsis
            .replace(/\u00A0/g, ' ')                           // nbsp
            .replace(/[\t\r\n]+/g, ' ')                        // collapse whitespace
            .replace(/[^\x20-\xFF]/g, '?');                    // strip anything else outside printable Latin-1
    };

    const handlePrintPDF = async (targetList: Intention[]) => {
        if (targetList.length === 0) return alert('Nenhuma intenção para exportar.');
        setGeneratingPdf(true);
        try {
            const pdfDoc = await PDFDocument.create();
            const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

            const M = { top: 55, bottom: 45, left: 50, right: 50 };
            const W = 595.28, H = 841.89;
            let page = pdfDoc.addPage([W, H]);
            let y = H - M.top;

            const drawPageHeader = () => {
                page.drawText('Apostolado de Garabandal', { x: M.left, y: H - 32, size: 9, font: fontRegular, color: rgb(0.55, 0.55, 0.55) });
                
                let titleSuffix = '';
                if (periodType === 'all') {
                    titleSuffix = 'Todo o Histórico';
                } else if (periodType === 'custom') {
                    const d1 = new Date(startDate).toLocaleDateString('pt-PT');
                    const d2 = new Date(endDate).toLocaleDateString('pt-PT');
                    titleSuffix = `${d1} até ${d2}`;
                } else {
                    const monthName = new Date(selectedMonth + '-01').toLocaleString('pt-PT', { month: 'long', year: 'numeric' });
                    titleSuffix = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                }
                
                const title = sanitizeForPDF('Livro de Intenções — ' + titleSuffix);
                page.drawText(title, { x: M.left, y: H - 46, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
                page.drawLine({ start: { x: M.left, y: H - 56 }, end: { x: W - M.right, y: H - 56 }, thickness: 0.8, color: rgb(0.75, 0.75, 0.75) });
                y = H - 72;
            };

            const checkPageBreak = (need: number) => {
                if (y - need < M.bottom) {
                    page = pdfDoc.addPage([W, H]);
                    drawPageHeader();
                }
            };

            drawPageHeader();

            targetList.forEach((intention, idx) => {
                const maxW = W - M.left - M.right - 16;
                const fs = 10.5, lh = 14;
                const safeText = sanitizeForPDF(intention.intention_text || '');
                const words = safeText.split(' ');
                const lines: string[] = [];
                let cur = '';
                for (const word of words) {
                    const test = cur + (cur ? ' ' : '') + word;
                    if (fontItalic.widthOfTextAtSize(test, fs) > maxW) { lines.push(cur); cur = word; }
                    else cur = test;
                }
                if (cur) lines.push(cur);

                const blockH = 14 + (intention.user_email ? 12 : 0) + lines.length * lh + 18;
                checkPageBreak(blockH);

                // Number badge
                const numStr = `${idx + 1}`;
                page.drawText(numStr, { x: M.left, y, size: 9, font: fontBold, color: rgb(0.6, 0.6, 0.6) });

                // Date
                const dateStr = new Date(intention.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });
                page.drawText(dateStr, { x: M.left + 20, y, size: 9, font: fontRegular, color: rgb(0.55, 0.55, 0.55) });

                // Name
                const safeName = sanitizeForPDF(intention.user_name || 'Anónimo');
                page.drawText(safeName, { x: M.left + 70, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

                // Donation badge
                if (intention.candle_type === 'donation') {
                    const lbl = sanitizeForPDF('• Donativo');
                    page.drawText(lbl, { x: W - M.right - fontBold.widthOfTextAtSize(lbl, 8.5), y, size: 8.5, font: fontBold, color: rgb(0.75, 0.35, 0) });
                }
                y -= 13;

                // Email
                if (intention.user_email) {
                    page.drawText(sanitizeForPDF(intention.user_email), { x: M.left + 70, y, size: 8, font: fontRegular, color: rgb(0.6, 0.6, 0.6) });
                    y -= 12;
                }

                // Intention text (indented, italic)
                for (const line of lines) {
                    page.drawText(line, { x: M.left + 12, y, size: fs, font: fontItalic, color: rgb(0.22, 0.22, 0.22) });
                    y -= lh;
                }

                y -= 6;
                page.drawLine({ start: { x: M.left, y }, end: { x: W - M.right, y }, thickness: 0.4, color: rgb(0.88, 0.88, 0.88) });
                y -= 14;
            });

            // Footer with page numbers
            const pages = pdfDoc.getPages();
            const generatedOn = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            for (let i = 0; i < pages.length; i++) {
                const p = pages[i];
                const ft = sanitizeForPDF(`Página ${i + 1} de ${pages.length}   ·   Gerado em ${generatedOn}   ·   ${targetList.length} intenções`);
                const fw = fontRegular.widthOfTextAtSize(ft, 7.5);
                p.drawText(ft, { x: (W - fw) / 2, y: 22, size: 7.5, font: fontRegular, color: rgb(0.6, 0.6, 0.6) });
            }

            const bytes = await pdfDoc.save();
            const blob = new Blob([bytes], { type: 'application/pdf' });
            window.open(URL.createObjectURL(blob), '_blank');
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert('Erro ao gerar PDF. Consulta a consola (F12) para ver o erro técnico exato.');
        } finally {
            setGeneratingPdf(false);
        }
    };

    if (!authChecked) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    const selectedIntentions = intentions.filter(i => selected.has(i.id));
    const selectedPendingCount = selectedIntentions.filter(i => i.status === 'pending').length;

    return (
        <div className="flex flex-col gap-6 pb-36 max-w-6xl mx-auto">
            {/* Top bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Portal de Orações</h1>
                    {userEmail && <p className="text-sm text-slate-500 font-medium">{userEmail}</p>}
                </div>
                <button onClick={handleSignOut} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-all">
                    <LogOut className="w-5 h-5" />
                    Sair da conta
                </button>
            </div>

            {/* Dashboard / Month Selector */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
                <div className="w-full xl:w-auto flex flex-col gap-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Período de Análise</label>
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <select
                            value={periodType}
                            onChange={(e) => setPeriodType(e.target.value as any)}
                            className="w-full sm:w-auto px-3 py-2 bg-slate-100 border-2 border-slate-200 rounded-lg outline-none text-sm font-bold text-slate-800 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all cursor-pointer"
                        >
                            <option value="month">Mês Específico</option>
                            <option value="custom">Período Personalizado</option>
                            <option value="all">Todo o Histórico</option>
                        </select>

                        {periodType === 'month' && (
                            <div className="relative w-full sm:w-auto">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-600" />
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(e.target.value)}
                                    className="w-full sm:w-auto pl-9 pr-3 py-2 bg-white border-2 border-slate-200 rounded-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 outline-none text-sm font-bold text-slate-900 transition-all cursor-pointer shadow-sm"
                                />
                            </div>
                        )}

                        {periodType === 'custom' && (
                            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full sm:w-auto px-3 py-2 bg-white border-2 border-slate-200 rounded-lg focus:border-yellow-500 outline-none text-sm font-bold text-slate-900 shadow-sm"
                                />
                                <span className="text-slate-400 font-bold text-xs">até</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="w-full sm:w-auto px-3 py-2 bg-white border-2 border-slate-200 rounded-lg focus:border-yellow-500 outline-none text-sm font-bold text-slate-900 shadow-sm"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full xl:w-auto">
                    {[
                        { label: 'Total', value: stats.total, color: 'text-slate-800', bg: 'bg-slate-50' },
                        { label: 'Pendentes', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
                        { label: 'Apresentadas', value: stats.presented, color: 'text-green-600', bg: 'bg-green-50' },
                        { label: 'Donativos', value: stats.donations, color: 'text-orange-600', bg: 'bg-orange-50' },
                    ].map(s => (
                        <div key={s.label} className={`flex flex-col p-3 rounded-xl border border-slate-100 ${s.bg}`}>
                            <span className={`text-2xl font-black ${s.color}`}>{s.value}</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar por nome, email ou palavras..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all bg-white"
                    />
                </div>

                {/* Status Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
                    {(['all', 'pending', 'presented'] as StatusFilter[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`flex-1 min-w-[100px] px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusFilter === f ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        >
                            {f === 'all' ? 'Ver Todas' : f === 'pending' ? 'Só Pendentes' : 'Só Apresentadas'}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Main List Area */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                
                {/* List Header & Quick Actions */}
                {!loading && filtered.length > 0 && (
                    <div className="p-4 border-b-2 border-slate-100 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button 
                                onClick={toggleAllVisible} 
                                className="flex items-center justify-center gap-2 w-full md:w-auto px-4 py-2 bg-white border-2 border-slate-200 rounded-lg font-bold text-slate-700 text-sm hover:border-yellow-400 hover:bg-yellow-50 transition-all active:scale-95"
                            >
                                {allVisibleSelected ? <CheckSquare className="w-5 h-5 text-amber-500" /> : <Square className="w-5 h-5 text-slate-400" />}
                                {allVisibleSelected ? 'Desmarcar Lista' : 'Selecionar Esta Lista'}
                            </button>
                        </div>
                        
                        <div className="text-right w-full md:w-auto">
                            {someSelected ? (
                                <span className="text-sm font-black text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200">
                                    {selected.size} selecionadas
                                </span>
                            ) : (
                                <span className="text-sm font-bold text-slate-400">
                                    {filtered.length} resultados encontrados
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* The List */}
                {loading ? (
                    <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-yellow-500" />
                        <span className="text-lg font-medium">A carregar intenções...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                            <Flame className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="text-lg font-medium">
                            {intentions.length === 0
                                ? 'Nenhuma intenção encontrada para este mês.'
                                : 'Nenhuma intenção corresponde à tua pesquisa/filtros.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y-2 divide-slate-100">
                        {filtered.map((intention, idx) => {
                            const isSelected = selected.has(intention.id);
                            const isPending = intention.status === 'pending';
                            return (
                                <div
                                    key={intention.id}
                                    onClick={() => toggleOne(intention.id)}
                                    className={`p-4 md:p-6 cursor-pointer transition-all duration-200 ${isSelected ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="flex items-start gap-4">
                                        
                                        {/* Big Checkbox */}
                                        <div className="mt-0.5 shrink-0">
                                            {isSelected
                                                ? <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center shadow-sm"><CheckSquare className="w-4 h-4 text-white" /></div>
                                                : <div className="w-6 h-6 rounded-md border-2 border-slate-300 bg-white hover:border-amber-400 transition-colors" />}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                                <span className="text-xs font-black text-slate-300 w-5">#{idx + 1}</span>
                                                <span className="text-base font-black text-slate-900 flex items-center gap-1.5">
                                                    <User className="w-4 h-4 text-slate-400" />
                                                    {intention.user_name || 'Anónimo'}
                                                </span>
                                                {intention.candle_type === 'donation' && (
                                                    <span className="bg-orange-100 text-orange-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-orange-200 uppercase tracking-widest shadow-sm">
                                                        Donativo
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm ml-auto ${isPending ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                                                    {isPending ? 'Pendente' : 'Apresentada'}
                                                </span>
                                            </div>

                                            {/* Intention Text - Huge and Readable */}
                                            <p className="text-base md:text-lg text-slate-800 leading-relaxed font-serif italic py-3 pl-4 border-l-4 border-slate-200 mb-2 bg-white/50 rounded-r-xl">
                                                "{intention.intention_text}"
                                            </p>

                                            <div className="flex flex-wrap items-center gap-4 mt-2">
                                                {intention.user_email && (
                                                    <div className="text-sm font-medium text-slate-500 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                                                        <Mail className="w-4 h-4" />
                                                        {intention.user_email}
                                                    </div>
                                                )}
                                                <div className="text-sm font-medium text-slate-400 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                                                    <Calendar className="w-4 h-4" />
                                                    {new Date(intention.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Floating Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-50 px-4 py-3 md:py-4 safe-area-bottom">
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
                    
                    <div className="hidden lg:block text-sm text-slate-600 font-medium">
                        {someSelected ? (
                            <span>
                                Tens <strong className="text-amber-600 font-black">{selected.size}</strong> intenções selecionadas.
                                {selectedPendingCount > 0 && <span> Destas, <strong className="text-slate-900">{selectedPendingCount}</strong> estão pendentes.</span>}
                            </span>
                        ) : (
                            <span className="text-slate-400">
                                Seleciona as intenções que queres exportar ou marcar como concluídas.
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <button
                            onClick={() => handlePrintPDF(someSelected ? selectedIntentions : filtered)}
                            disabled={generatingPdf || (someSelected ? selected.size === 0 : filtered.length === 0)}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 h-12 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                        >
                            {generatingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                            Exportar PDF ({someSelected ? selected.size : filtered.length})
                        </button>
                        
                        <button
                            onClick={handleMarkPresented}
                            disabled={markingDone || (someSelected ? selectedPendingCount === 0 : stats.pending === 0)}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 h-12 bg-green-500 text-white font-bold text-sm rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/10 active:scale-95"
                        >
                            {markingDone ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                            Marcar Apresentadas ({someSelected ? selectedPendingCount : stats.pending})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
