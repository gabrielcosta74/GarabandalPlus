"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import {
    Loader2,
    Star,
    Mail,
    Phone,
    Copy,
    Check,
    Download,
    CalendarClock,
    Globe,
    TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast, Toaster } from 'sonner';

/** Só os leads escritos por /api/early-access-signup. */
const EARLY_ACCESS_SOURCE = 'early_access_page';
const CAMPAIGN_SLUG = 'caminho-mariano-2027';

/** Datas da campanha — as mesmas que a landing page e o email anunciam. */
const EARLY_ACCESS_DATE = new Date('2026-10-13T00:00:00Z');
const PUBLIC_DATE = new Date('2026-10-15T00:00:00Z');

type EarlyAccessLead = {
    id: string;
    created_at: string;
    updated_at?: string | null;
    email: string;
    phone?: string | null;
    name?: string | null;
    status: string;
    data?: {
        source?: string;
        campaign_slug?: string;
        campaign_title?: string;
        locale?: string;
        consent_state?: string;
        consented_at?: string;
        early_access_opens_on?: string;
        public_registration_opens_on?: string;
    } | null;
};

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

export default function AdminEarlyAccessPage() {
    const [leads, setLeads] = useState<EarlyAccessLead[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeads = async () => {
            if (!supabaseBrowser) return;
            setLoading(true);
            const { data, error } = await supabaseBrowser
                .from('booking_leads')
                .select('id,created_at,updated_at,email,phone,name,status,data')
                .eq('status', 'interested')
                .filter('data->>source', 'eq', EARLY_ACCESS_SOURCE)
                .order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching early-access leads:', error);
                toast.error('Erro ao carregar a lista prioritária.');
            }
            if (!error && data) setLeads(data as unknown as EarlyAccessLead[]);
            setLoading(false);
        };
        fetchLeads();
    }, []);

    const stats = useMemo(() => {
        const now = Date.now();
        const dayAgo = now - 24 * 60 * 60 * 1000;
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

        let pt24 = 0;
        let last24 = 0;
        let last7d = 0;
        const byLocale = new Map<string, number>();

        for (const lead of leads) {
            const created = new Date(lead.created_at).getTime();
            if (created > dayAgo) last24 += 1;
            if (created > weekAgo) last7d += 1;
            const locale = (lead.data?.locale || 'pt').toUpperCase();
            byLocale.set(locale, (byLocale.get(locale) || 0) + 1);
        }
        void pt24;

        const daysToAccess = Math.ceil((EARLY_ACCESS_DATE.getTime() - now) / (24 * 60 * 60 * 1000));

        return {
            total: leads.length,
            last24,
            last7d,
            locales: Array.from(byLocale.entries()).sort((a, b) => b[1] - a[1]),
            daysToAccess,
        };
    }, [leads]);

    const exportCsv = () => {
        const header = ['email', 'telefone', 'nome', 'idioma', 'inscrito_em'];
        const rows = leads.map((lead) => [
            lead.email,
            lead.phone || '',
            (lead.name || '').replace(/"/g, '""'),
            lead.data?.locale || 'pt',
            new Date(lead.created_at).toISOString(),
        ]);
        const csv = [header, ...rows]
            .map((row) => row.map((cell) => `"${String(cell)}"`).join(','))
            .join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lista-prioritaria-${CAMPAIGN_SLUG}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`${leads.length} contactos exportados.`);
    };

    return (
        <AdminLayout title="Lista prioritária — Acesso antecipado" isLoading={loading}>
            <Toaster richColors position="bottom-right" />

            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Intro */}
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100 rounded-2xl p-5 flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600 shrink-0"><Star className="w-5 h-5" /></div>
                    <div>
                        <h2 className="font-bold text-amber-900">
                            Caminho Mariano 2027 — lista prioritária de acesso
                        </h2>
                        <p className="text-sm text-amber-800/80 leading-relaxed">
                            Pessoas que pediram <strong>acesso antecipado</strong> à peregrinação de <strong>outubro de 2027</strong> pela
                            página <code className="text-[11px] bg-amber-100/70 px-1 py-0.5 rounded">/acesso-antecipado</code>.
                            Não é lista de espera: são os contactos que recebem o link de inscrição a{' '}
                            <strong>{format(EARLY_ACCESS_DATE, "d 'de' MMMM", { locale: pt })}</strong>, 48h antes da abertura
                            pública a {format(PUBLIC_DATE, "d 'de' MMMM", { locale: pt })}.
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Star className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Na lista</span>
                        </div>
                        <div className="text-3xl font-black text-slate-800">{stats.total}</div>
                        <p className="text-[11px] text-slate-400 mt-1">Recebem o link a 13 de outubro</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-100 rounded-lg text-green-600"><TrendingUp className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Últimas 24h</span>
                        </div>
                        <div className="text-3xl font-black text-slate-800">{stats.last24}</div>
                        <p className="text-[11px] text-slate-400 mt-1">{stats.last7d} nos últimos 7 dias</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Globe className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Por idioma</span>
                        </div>
                        <div className="space-y-1 mt-1">
                            {stats.locales.length === 0 ? (
                                <div className="text-sm text-slate-400">—</div>
                            ) : stats.locales.map(([locale, count]) => (
                                <div key={locale} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="text-slate-600 font-bold">{locale}</span>
                                    <span className="font-bold text-slate-800">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><CalendarClock className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Faltam</span>
                        </div>
                        <div className="text-3xl font-black text-slate-800">
                            {stats.daysToAccess > 0 ? stats.daysToAccess : 0}
                            <span className="text-base font-bold text-slate-400 ml-1">dias</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Até abrir o acesso privado</p>
                    </div>
                </div>

                {/* Export */}
                <div className="flex justify-end">
                    <button
                        onClick={exportCsv}
                        disabled={!leads.length}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition-colors"
                    >
                        <Download className="w-4 h-4" /> Exportar CSV ({leads.length})
                    </button>
                </div>

                {/* Mobile: card list */}
                <div className="md:hidden space-y-3">
                    {loading ? (
                        <div className="h-32 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-200" /></div>
                    ) : leads.length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-slate-400 text-sm">Ainda ninguém pediu acesso antecipado.</div>
                    ) : leads.map((lead) => (
                        <div key={lead.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 truncate">{lead.name || '—'}</div>
                                    <div className="text-[11px] text-slate-400">
                                        {format(new Date(lead.created_at), "d MMM 'às' HH:mm", { locale: pt })}
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                                    {(lead.data?.locale || 'pt').toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="truncate">{lead.email}</span>
                                <CopyButton text={lead.email} />
                            </div>
                            {lead.phone ? (
                                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 font-mono">
                                    <Phone className="w-3 h-3 shrink-0" />
                                    <a href={`tel:${lead.phone}`} className="truncate hover:text-slate-800">{lead.phone}</a>
                                    <CopyButton text={lead.phone} />
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Inscrito em</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Pessoa</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Email</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Telefone</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Idioma</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="h-40 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-200" /></td></tr>
                            ) : leads.length === 0 ? (
                                <tr><td colSpan={5} className="h-40 text-center text-slate-400">Ainda ninguém pediu acesso antecipado.</td></tr>
                            ) : leads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{format(new Date(lead.created_at), 'd MMM', { locale: pt })}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{format(new Date(lead.created_at), 'HH:mm')}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{lead.name || '—'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                                <Mail className="w-3 h-3" />{lead.email}
                                            </span>
                                            <CopyButton text={lead.email} />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {lead.phone ? (
                                            <div className="flex items-center gap-2">
                                                <a href={`tel:${lead.phone}`} className="text-xs text-slate-500 font-mono flex items-center gap-1 hover:text-slate-800">
                                                    <Phone className="w-3 h-3" />{lead.phone}
                                                </a>
                                                <CopyButton text={lead.phone} />
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                            {(lead.data?.locale || 'pt').toUpperCase()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}
