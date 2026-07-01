"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import {
    Loader2,
    Star,
    Users,
    Phone,
    Mail,
    MessageCircle,
    Sparkles,
    Copy,
    Check,
} from 'lucide-react';
import { WhatsAppIcon } from '../../../../components/icons/WhatsAppIcon';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast, Toaster } from 'sonner';

type InterestLead = {
    id: string;
    created_at: string;
    updated_at?: string;
    pilgrimage_id: string | null;
    email: string;
    phone?: string | null;
    name?: string | null;
    status: string;
    data?: {
        source?: string;
        session_id?: string;
        pilgrimage_title?: string | null;
        locale?: string;
    } | null;
    pilgrimages?: {
        title: string;
        slug: string;
        start_date: string;
    } | null;
};

// Emails synthesised for one-tap captures (no real contact given).
const isSyntheticEmail = (email?: string | null) =>
    !email || email.startsWith('interesse+') || email.endsWith('@chat.local') || email.endsWith('@placeholder');

const sanitizePhone = (phone?: string | null) => (phone || '').replace(/[^\d]/g, '');

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={async (e) => {
                e.stopPropagation();
                await navigator.clipboard.writeText(text);
                setCopied(true);
                toast.success('Copiado!');
                setTimeout(() => setCopied(false), 2000);
            }}
            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
            title="Copiar"
        >
            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
        </button>
    );
}

export default function AdminInteressadosPage() {
    const [leads, setLeads] = useState<InterestLead[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeads = async () => {
            if (!supabaseBrowser) return;
            setLoading(true);
            const { data, error } = await supabaseBrowser
                .from('booking_leads')
                .select('*, pilgrimages(title, slug, start_date)')
                .eq('status', 'interested')
                .order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching interested leads:', error);
                toast.error('Erro ao carregar interessados.');
            }
            if (!error && data) setLeads(data as unknown as InterestLead[]);
            setLoading(false);
        };
        fetchLeads();
    }, []);

    const stats = useMemo(() => {
        const total = leads.length;
        const byPilgrimage = new Map<string, { title: string; isNovember: boolean; count: number }>();
        for (const l of leads) {
            const title = l.pilgrimages?.title || l.data?.pilgrimage_title || 'Sem peregrinação';
            const key = l.pilgrimage_id || title;
            const isNovember = /novembro|november/i.test(title) || (l.pilgrimages?.start_date || '').startsWith('2026-11');
            const entry = byPilgrimage.get(key) || { title, isNovember, count: 0 };
            entry.count += 1;
            byPilgrimage.set(key, entry);
        }
        const groups = Array.from(byPilgrimage.values()).sort((a, b) => b.count - a.count);
        return { total, groups };
    }, [leads]);

    const deriveRow = (lead: InterestLead) => {
        const title = lead.pilgrimages?.title || lead.data?.pilgrimage_title || '—';
        const isNovember = /novembro|november/i.test(title) || (lead.pilgrimages?.start_date || '').startsWith('2026-11');
        const hasEmail = !isSyntheticEmail(lead.email);
        const phoneDigits = sanitizePhone(lead.phone);
        const source = lead.data?.source === 'pilgrimage_page_interest' ? 'Página' : 'Chat';
        return { title, isNovember, hasEmail, phoneDigits, source };
    };

    return (
        <AdminLayout title="Interessados em ir" isLoading={loading}>
            <Toaster richColors position="bottom-right" />

            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Intro */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-5 flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600 shrink-0"><Sparkles className="w-5 h-5" /></div>
                    <div>
                        <h2 className="font-bold text-amber-900">Sinais de procura (lista de espera)</h2>
                        <p className="text-sm text-amber-800/80 leading-relaxed">
                            Pessoas que clicaram em <strong>&quot;Estou interessado em ir&quot;</strong> no chat ou na página de
                            uma peregrinação esgotada. Serve para avaliar a possibilidade de <strong>abrir mais lugares</strong>.
                            Muitos registos são de um toque (sem contacto) — o contacto real acontece pelo WhatsApp.
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Star className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Total de Cliques de Interesse</span>
                        </div>
                        <div className="text-3xl font-black text-slate-800">{stats.total}</div>
                        <p className="text-[11px] text-slate-400 mt-1">Sinal de procura para avaliar abrir mais lugares</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Users className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Por Peregrinação</span>
                        </div>
                        <div className="space-y-1 mt-1">
                            {stats.groups.length === 0 ? (
                                <div className="text-sm text-slate-400">—</div>
                            ) : stats.groups.map((g) => (
                                <div key={g.title} className="flex items-center justify-between gap-2 text-xs">
                                    <span className={`truncate ${g.isNovember ? 'font-bold text-amber-700' : 'text-slate-600'}`}>
                                        {g.isNovember && <Star className="w-3 h-3 inline mr-1 -mt-0.5" />}
                                        {g.title}
                                    </span>
                                    <span className="font-bold text-slate-800 shrink-0">{g.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Mobile: card list */}
                <div className="md:hidden space-y-3">
                    {loading ? (
                        <div className="h-32 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-200" /></div>
                    ) : leads.length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-slate-400 text-sm">Ainda não há interessados registados.</div>
                    ) : leads.map((lead) => {
                        const { title, isNovember, hasEmail, phoneDigits, source } = deriveRow(lead);
                        return (
                            <div key={lead.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-800 truncate">{lead.name || 'Anónimo'}</div>
                                        <div className="text-[11px] text-slate-400">{format(new Date(lead.created_at), "d MMM 'às' HH:mm", { locale: pt })}</div>
                                    </div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                                        <MessageCircle className="w-3 h-3" />{source}
                                    </span>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border mb-3 ${isNovember ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                    {isNovember && <Star className="w-3 h-3" />}
                                    {title}
                                </span>
                                {hasEmail && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-1"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{lead.email}</span><CopyButton text={lead.email} /></div>
                                )}
                                {phoneDigits && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-3"><Phone className="w-3 h-3 shrink-0" />{lead.phone}<CopyButton text={lead.phone || ''} /></div>
                                )}
                                {!hasEmail && !phoneDigits && (
                                    <div className="text-[11px] text-slate-400 italic mb-3">Um toque · sem contacto</div>
                                )}
                                {phoneDigits && (
                                    <a
                                        href={`https://wa.me/${phoneDigits}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-[#25D366] hover:bg-[#1fb858] text-white shadow-sm transition-colors"
                                    >
                                        <WhatsAppIcon className="w-4 h-4" /> Abrir WhatsApp
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Data</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Pessoa</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Peregrinação</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Origem</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">WhatsApp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="h-40 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-200" /></td></tr>
                            ) : leads.length === 0 ? (
                                <tr><td colSpan={5} className="h-40 text-center text-slate-400">Ainda não há interessados registados.</td></tr>
                            ) : leads.map((lead) => {
                                const { title, isNovember, hasEmail, phoneDigits, source } = deriveRow(lead);
                                return (
                                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-700">{format(new Date(lead.created_at), 'd MMM', { locale: pt })}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{format(new Date(lead.created_at), 'HH:mm')}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{lead.name || 'Anónimo'}</div>
                                            {hasEmail && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>
                                                    <CopyButton text={lead.email} />
                                                </div>
                                            )}
                                            {phoneDigits && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                                                    <CopyButton text={lead.phone || ''} />
                                                </div>
                                            )}
                                            {!hasEmail && !phoneDigits && (
                                                <div className="text-[11px] text-slate-400 italic mt-0.5">Um toque · sem contacto</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${isNovember ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                {isNovember && <Star className="w-3 h-3" />}
                                                {title}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                <MessageCircle className="w-3 h-3" />{source}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {phoneDigits ? (
                                                <a
                                                    href={`https://wa.me/${phoneDigits}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#25D366] hover:bg-[#1fb858] text-white shadow-sm transition-colors"
                                                >
                                                    <WhatsAppIcon className="w-3 h-3" /> Abrir
                                                </a>
                                            ) : (
                                                <span className="text-xs text-slate-300">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}
