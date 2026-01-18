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
    AlertTriangle
} from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { useRouter } from 'next/navigation';

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

export default function AdminIntentionsPage() {
    const [intentions, setIntentions] = useState<EnrichedIntention[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        loadIntentions();
    }, [selectedMonth]);

    const loadIntentions = async () => {
        setLoading(true);
        setErrorMsg(null);
        if (!supabaseBrowser) {
            setLoading(false);
            return;
        }

        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

        console.log("Fetching intentions for:", startDate, "to", endDate);

        try {
            // 1. Try RPC Function
            const { data: rpcData, error: rpcError } = await supabaseBrowser
                .rpc('get_monthly_intentions', {
                    start_date: startDate,
                    end_date: endDate
                });

            if (!rpcError && rpcData) {
                console.log("RPC Success:", rpcData.length);
                setIntentions(rpcData as EnrichedIntention[]);
                setLoading(false);
                return;
            }

            console.warn("RPC Failed, trying fallback:", rpcError?.message);

            let msg = rpcError?.message || "Erro desconhecido";
            if (msg.includes('function') && msg.includes('does not exist')) {
                msg = "Função de base de dados desatualizada. Por favor corra a migração novamente.";
            }

            setErrorMsg(`Erro de carregamento: ${msg}. Usando visualização básica.`);

            // 2. Fallback
            const { data: fallbackData, error: fallbackError } = await supabaseBrowser
                .from('prayer_intentions')
                .select('*')
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .order('created_at', { ascending: false });

            if (fallbackError) {
                throw fallbackError;
            }

            if (fallbackData) {
                const mapped: EnrichedIntention[] = fallbackData.map(i => ({
                    ...i,
                    user_name: 'Desconhecido',
                    user_email: ''
                }));
                setIntentions(mapped);
            }

        } catch (err: any) {
            console.error("Critical loader error:", err);
            setErrorMsg(err.message || "Erro desconhecido");
            setIntentions([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintPDF = async () => {
        setGeneratingPdf(true);
        try {
            const pdfDoc = await PDFDocument.create();
            const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

            // Configuration
            const margins = { top: 50, bottom: 50, left: 50, right: 50 };
            const pageSize = { width: 595.28, height: 841.89 }; // A4
            let page = pdfDoc.addPage([pageSize.width, pageSize.height]);
            let y = pageSize.height - margins.top;

            // Helper to add new page
            const checkPageBreak = (neededSpace: number) => {
                if (y - neededSpace < margins.bottom) {
                    page = pdfDoc.addPage([pageSize.width, pageSize.height]);
                    y = pageSize.height - margins.top;
                    drawHeader(); // Re-draw header on new page
                }
            };

            // Draw Header
            const drawHeader = () => {
                page.drawText('Apostolado de Garabandal', {
                    x: margins.left,
                    y: pageSize.height - 40,
                    size: 10,
                    font: fontRegular,
                    color: rgb(0.5, 0.5, 0.5)
                });
                page.drawText('Livro de Intenções', {
                    x: margins.left,
                    y: pageSize.height - 65,
                    size: 24,
                    font: fontBold,
                    color: rgb(0.1, 0.1, 0.1)
                });

                const monthName = new Date(selectedMonth).toLocaleString('pt-PT', { month: 'long', year: 'numeric' });
                page.drawText(monthName.charAt(0).toUpperCase() + monthName.slice(1), {
                    x: margins.left,
                    y: pageSize.height - 85,
                    size: 14,
                    font: fontRegular,
                    color: rgb(0.4, 0.4, 0.4)
                });

                // Divider line
                page.drawLine({
                    start: { x: margins.left, y: pageSize.height - 100 },
                    end: { x: pageSize.width - margins.right, y: pageSize.height - 100 },
                    thickness: 1,
                    color: rgb(0.8, 0.8, 0.8),
                });

                if (y > pageSize.height - 100) y = pageSize.height - 110;
                else y -= 40;
            };

            drawHeader();
            y = pageSize.height - 120; // Start content below header on first page

            // Content
            for (const intention of intentions) {
                // Approximate height calculation
                const words = intention.intention_text.split(' ');
                const maxWidth = pageSize.width - margins.left - margins.right - 20; // -20 for padding
                const fontSize = 11;
                const lineHeight = 14;

                // Calculate lines first
                let lines: string[] = [];
                let currentLine = '';
                for (const word of words) {
                    const testLine = currentLine + (currentLine ? ' ' : '') + word;
                    const width = fontRegular.widthOfTextAtSize(testLine, fontSize);
                    if (width > maxWidth) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine) lines.push(currentLine);

                const itemHeight = 40 + (lines.length * lineHeight) + 20; // Meta height + text height + padding
                checkPageBreak(itemHeight);

                // --- Draw Item ---

                // Meta info row
                const date = new Date(intention.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                page.drawText(date, { x: margins.left, y, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });

                page.drawText(intention.user_name || 'Anónimo', {
                    x: margins.left + 50,
                    y,
                    size: 11,
                    font: fontBold,
                    color: rgb(0.1, 0.1, 0.1)
                });

                if (intention.candle_type === 'donation') {
                    const label = '(Donativo)';
                    page.drawText(label, {
                        x: pageSize.width - margins.right - fontBold.widthOfTextAtSize(label, 9),
                        y,
                        size: 9,
                        font: fontBold,
                        color: rgb(0.8, 0.4, 0) // Orange-ish
                    });
                }

                y -= 15;

                // User Email (Small)
                if (intention.user_email) {
                    page.drawText(intention.user_email, {
                        x: margins.left + 50,
                        y: y + 3,
                        size: 8,
                        font: fontRegular,
                        color: rgb(0.6, 0.6, 0.6)
                    });
                    y -= 15;
                }

                // Intention Text
                for (const line of lines) {
                    page.drawText(line, { x: margins.left + 20, y, size: fontSize, font: fontItalic, color: rgb(0.2, 0.2, 0.2) });
                    y -= lineHeight;
                }

                y -= 10; // Extra padding

                // Separator (Dotted or light line)
                page.drawLine({
                    start: { x: margins.left + 20, y },
                    end: { x: pageSize.width - margins.right - 20, y },
                    thickness: 0.5,
                    color: rgb(0.9, 0.9, 0.9),
                });

                y -= 25; // Margin for next item
            }

            // Footer (Page Numbers)
            const pages = pdfDoc.getPages();
            for (let i = 0; i < pages.length; i++) {
                const p = pages[i];
                const footerText = `Página ${i + 1} de ${pages.length} - Gerado em ${new Date().toLocaleDateString('pt-PT')}`;
                const textWidth = fontRegular.widthOfTextAtSize(footerText, 8);
                p.drawText(footerText, {
                    x: (pageSize.width - textWidth) / 2,
                    y: 20,
                    size: 8,
                    font: fontRegular,
                    color: rgb(0.6, 0.6, 0.6),
                });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Erro ao gerar PDF");
        } finally {
            setGeneratingPdf(false);
        }
    };

    const markAsPresented = async () => {
        if (!confirm('Marcar todas as intenções deste mês como "Apresentadas"?')) return;
        alert("Funcionalidade simulada: Estado atualizado.");
    };

    return (
        <AdminLayout title="Gestão de Intenções">
            <div className="flex flex-col gap-6">

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
                            disabled={intentions.length === 0}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Marcar Feito
                        </button>
                    </div>
                </div>

                {/* Error Box */}
                {errorMsg && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3 text-orange-800">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div className="text-sm">
                            <strong>Aviso:</strong> {errorMsg}
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400">Carregando dados...</div>
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
                                <div key={intention.id} className="p-6 hover:bg-slate-50 transition-colors group">
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-3">
                                        <div className="flex flex-col gap-1">

                                            {/* User Info */}
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

            </div>
        </AdminLayout>
    );
}
