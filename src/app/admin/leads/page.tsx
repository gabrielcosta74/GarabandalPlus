"use client";

import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
    Loader2,
    Mail,
    CheckCircle,
    Clock,
    AlertCircle,
    Search,
    Filter,
    ArrowUpRight,
    Users,
    Inbox,
    Copy,
    Check,
    Star
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast, Toaster } from 'sonner';

type Lead = {
    id: string;
    created_at: string;
    pilgrimage_id: string;
    email: string;
    phone?: string;
    name?: string;
    status: string;
    last_notified_at?: string;
    data?: {
        source?: string;
        campaign_slug?: string;
        campaign_title?: string;
        locale?: string;
    } | null;
    pilgrimages?: {
        title: string;
        deposit_value: number;
    } | null;
}

/**
 * Nem todos os leads sem `pilgrimage_id` são lista de espera genérica: os do
 * acesso antecipado ainda não têm peregrinação criada na base, mas trazem a
 * campanha no `data`. Sem isto apareciam todos como "Lista de Espera Geral".
 */
const EARLY_ACCESS_SOURCE = 'early_access_page';

function LeadInterestBadge({ lead }: { lead: Lead }) {
    if (lead.data?.source === EARLY_ACCESS_SOURCE) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <Star className="w-3 h-3" />
                {lead.data.campaign_title || 'Acesso antecipado'}
            </span>
        );
    }

    if (lead.pilgrimages) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                {lead.pilgrimages.title}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
            <Users className="w-3 h-3" />
            Lista de Espera Geral
        </span>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const onCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copiado!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={onCopy}
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Copiar"
        >
            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
        </button>
    );
}

export default function AdminLeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'notified' | 'recovered'>('all');
    const [accessToken, setAccessToken] = useState<string | null>(null);

    const fetchLeads = async () => {
        if (!supabaseBrowser) return;
        setLoading(true);
        const { data, error } = await supabaseBrowser
            .from('booking_leads')
            .select('*, pilgrimages(title, deposit_value)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching leads:", error);
            toast.error("Erro ao carregar leads.");
        }

        if (!error && data) {
            setLeads(data as unknown as Lead[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    useEffect(() => {
        const loadToken = async () => {
            if (!supabaseBrowser) return;
            const { data } = await supabaseBrowser.auth.getSession();
            setAccessToken(data.session?.access_token || null);
        };
        loadToken();
    }, []);

    const handleManualRecovery = async (lead: Lead) => {
        if (!confirm(`Enviar notificação manual para ${lead.email}?`)) return;
        setSending(lead.id);

        try {
            const res = await fetch('/api/leads/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ leadId: lead.id })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Falha ao enviar');

            toast.success("Notificação enviada com sucesso!");
            await fetchLeads();

        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Erro ao processar.");
        } finally {
            setSending(null);
        }
    };

    // Derived State
    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            const matchesSearch =
                (lead.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (lead.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'all'
                ? true
                : statusFilter === 'notified'
                    ? (lead.status === 'notified' || lead.status === 'recovered')
                    : lead.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [leads, searchTerm, statusFilter]);

    const stats = useMemo(() => {
        const total = leads.length;
        const notified = leads.filter(l => l.status === 'notified' || l.status === 'recovered').length;
        const waiting = leads.filter(l => l.status === 'draft' || l.status === 'waitlist').length;
        const conversionRate = total > 0 ? ((notified / total) * 100).toFixed(1) : 0;

        return { total, notified, waiting, conversionRate };
    }, [leads]);

    return (
        <AdminLayout title="Gestão de Leads" isLoading={loading}>
            <Toaster richColors position="bottom-right" />

            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Inbox className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Total Leads</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Clock className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Pendentes</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{stats.waiting}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Mail className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Notificados</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{stats.notified}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><ArrowUpRight className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-slate-500">Taxa Resposta</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{stats.conversionRate}%</div>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Pesquisar nome ou email..."
                                className="w-full pl-9 pr-4 py-2 bg-transparent outline-none text-sm font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        {['all', 'draft', 'notified'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors whitespace-nowrap ${statusFilter === s
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {s === 'all' ? 'Todos' : s === 'draft' ? 'Pendentes' : 'Contactados'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Data</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Lead</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Interesse</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Estado</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="h-40 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-200" />
                                    </td>
                                </tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="h-40 text-center text-slate-400">
                                        Nenhum lead encontrado.
                                    </td>
                                </tr>
                            ) : filteredLeads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">
                                            {format(new Date(lead.created_at), "d MMM", { locale: pt })}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                            {format(new Date(lead.created_at), "HH:mm")}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="font-bold text-slate-800">{lead.name || 'Sem nome'}</div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 group/copy">
                                            <div className="text-xs text-slate-500 font-mono">{lead.email}</div>
                                            <CopyButton text={lead.email} />
                                        </div>
                                        {lead.phone && (
                                            <div className="flex items-center gap-2 mt-0.5 group/copy">
                                                <div className="text-[10px] text-slate-400 font-mono">{lead.phone}</div>
                                                <CopyButton text={lead.phone} />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <LeadInterestBadge lead={lead} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={lead.status} notifiedAt={lead.last_notified_at} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lead.status === 'draft' || lead.status === 'waitlist'
                                                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 hover:shadow-md'
                                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                    }`}
                                                onClick={() => handleManualRecovery(lead)}
                                                disabled={sending === lead.id}
                                                title="Enviar notificação agora"
                                            >
                                                {sending === lead.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Mail className="w-3 h-3" />
                                                )}
                                                <span className="hidden sm:inline">Notificar</span>
                                            </button>
                                        </div>
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

function StatusBadge({ status, notifiedAt }: { status: string, notifiedAt?: string }) {
    if (status === 'draft') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                <AlertCircle className="w-3.5 h-3.5" />
                Pendente
            </span>
        );
    }

    if (status === 'notified' || status === 'recovered') {
        return (
            <div className="flex flex-col items-start gap-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Notificado
                </span>
                {notifiedAt ? (
                    <span className="text-[9px] text-slate-400 ml-1 font-mono uppercase tracking-wide">
                        {format(new Date(notifiedAt), "dd/MM HH:mm", { locale: pt })}
                    </span>
                ) : (
                    <span className="text-[9px] text-slate-400 ml-1">Sem data</span>
                )}
            </div>
        );
    }

    if (status === 'waitlist') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                <Clock className="w-3.5 h-3.5" />
                Em Espera
            </span>
        );
    }

    return <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded-lg">{status}</span>;
}
