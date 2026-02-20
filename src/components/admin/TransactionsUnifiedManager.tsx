"use client";

import React, { useEffect, useState, useMemo } from 'react';
import {
    CreditCard,
    Heart,
    Users,
    Plane,
    Download,
    ExternalLink,
    CheckCircle,
    Clock,
    AlertCircle,
    FileText,
    TrendingUp,
    Calendar,
    Copy,
    ShoppingBag,
    Printer
} from 'lucide-react';
import AdminTable from './AdminTable';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import TransactionFilters, { TransactionFiltersState } from './TransactionFilters';
import TransactionDetailsModal, { TransactionDetail } from './TransactionDetailsModal';

type ConsolidatedTransaction = {
    id: string;
    category: 'shop' | 'donation' | 'quota' | 'pilgrimage';
    reference: string;
    amount: number;
    currency: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_nif?: string | null;
    customer_address?: string | null;
    customer_city?: string | null;
    customer_zip?: string | null;
    customer_country?: string | null;
    status: string;
    method: string | null;
    provider: string | null;
    created_at: string;
    proof_url?: string;
    notes?: string;
    details_link: string;
    items?: Array<{ name: string; qty: number; price: number; total: number }>;
    invoice_sent_at?: string | null;
    has_nif?: boolean;
};

export default function TransactionsUnifiedManager() {
    const [transactions, setTransactions] = useState<ConsolidatedTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [selectedTransaction, setSelectedTransaction] = useState<ConsolidatedTransaction | null>(null);

    // Modern Filters State
    const [filters, setFilters] = useState<TransactionFiltersState>({
        category: 'all',
        status: 'all',
        receipt: 'all',
        nif: 'all',
        search: ''
    });

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleToggleInvoice = async (t: TransactionDetail) => {
        try {
            if (!supabaseBrowser) throw new Error('Supabase unavailable');
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            const token = session?.access_token;

            const newStatus = !t.invoice_sent_at;

            const res = await fetch('/api/admin/transactions/update-invoice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    id: t.id,
                    category: t.category,
                    receiptSent: newStatus
                })
            });

            if (!res.ok) throw new Error('Falha ao atualizar estado do recibo');

            const timestamp = newStatus ? new Date().toISOString() : null;

            // Update local state
            setTransactions(prev => prev.map(item =>
                item.id === t.id ? { ...item, invoice_sent_at: timestamp } : item
            ));

            if (selectedTransaction?.id === t.id) {
                setSelectedTransaction(prev => prev ? { ...prev, invoice_sent_at: timestamp } : null);
            }

        } catch (err: any) {
            console.error(err);
            alert(`Erro ao atualizar estado: ${err.message}`);
        }
    };

    const fetchData = async () => {
        if (!supabaseBrowser) return;
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) {
                setError("Sessão expirada. Por favor, faça login novamente.");
                return;
            }

            const res = await fetch('/api/admin/transactions/consolidated', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
            const data = await res.json();
            setTransactions(data.transactions || []);
        } catch (error: any) {
            console.error('Error fetching transactions:', error);
            setError("Não foi possível carregar os dados financeiros.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Auto-refresh every 2 minutes
        const interval = setInterval(fetchData, 120000);
        return () => clearInterval(interval);
    }, []);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesCategory = filters.category === 'all' || t.category === filters.category;

            // Map common status terms
            const s = t.status.toLowerCase();
            let matchesStatus = true;
            if (filters.status === 'paid') matchesStatus = ['paid', 'pago', 'verified', 'succeeded'].includes(s);
            if (filters.status === 'pending') matchesStatus = ['pending', 'pendente', 'verifying', 'pending_verification'].includes(s);
            if (filters.status === 'failed') matchesStatus = ['failed', 'canceled'].includes(s);

            let matchesReceipt = true;
            if (filters.receipt === 'sent') matchesReceipt = !!t.invoice_sent_at;
            if (filters.receipt === 'pending') matchesReceipt = !t.invoice_sent_at;

            let matchesNif = true;
            const hasNif = typeof t.customer_nif === 'string' && t.customer_nif.trim().length > 0;
            if (filters.nif === 'with_nif') matchesNif = hasNif;
            if (filters.nif === 'without_nif') matchesNif = !hasNif;

            const searchLower = filters.search.toLowerCase();
            const matchesSearch = !filters.search ||
                t.customer_name?.toLowerCase().includes(searchLower) ||
                t.customer_email?.toLowerCase().includes(searchLower) ||
                t.customer_nif?.includes(searchLower) ||
                t.reference.toLowerCase().includes(searchLower);

            return matchesCategory && matchesStatus && matchesReceipt && matchesNif && matchesSearch;
        });
    }, [transactions, filters]);

    const categories = [
        { id: 'shop', label: 'Loja Online', icon: ShoppingBag, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
        { id: 'donation', label: 'Doação', icon: Heart, color: 'text-rose-600 bg-rose-50 border-rose-200' },
        { id: 'quota', label: 'Quota', icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        { id: 'pilgrimage', label: 'Peregrinação', icon: Plane, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    ];

    const exportToCSV = () => {
        const headers = ['Data', 'Categoria', 'Ref', 'Nome', 'Email', 'NIF', 'Valor', 'Status', 'Recibo Enviado'];
        const rows = filteredTransactions.map(t => [
            format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
            t.category,
            t.reference,
            t.customer_name || '-',
            t.customer_email || '-',
            t.customer_nif || '-',
            t.amount,
            t.status,
            t.invoice_sent_at ? 'Sim' : 'Não'
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(';')).join('\n');
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transacoes_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns = [
        {
            key: 'created_at',
            header: 'Data / Ref',
            render: (t: ConsolidatedTransaction) => (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-900 text-sm">{format(new Date(t.created_at), 'dd MMM', { locale: pt })}</span>
                    <span className="text-[10px] text-gray-500 font-mono mt-0.5" title={t.reference}>#{t.reference.substring(0, 8)}...</span>
                </div>
            )
        },
        {
            key: 'category',
            header: 'Origem (Tipo)',
            render: (t: ConsolidatedTransaction) => {
                const cat = categories.find(c => c.id === t.category);
                const Icon = cat?.icon || CreditCard;
                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider shadow-sm ${cat?.color}`}>
                        <Icon className="w-3 h-3" />
                        {cat?.label}
                    </div>
                );
            }
        },
        {
            key: 'entity',
            header: 'Entidade (Nome/NIF)',
            render: (t: ConsolidatedTransaction) => (
                <div className="flex flex-col max-w-[180px]">
                    <span className="font-bold text-gray-900 text-sm truncate" title={t.customer_name || ''}>{t.customer_name || 'Anónimo'}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                        {t.customer_nif ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleCopy(t.customer_nif!, `nif-${t.id}`); }}
                                className="group flex items-center gap-1 text-[11px] font-mono text-gray-500 hover:text-garabandal-dark bg-gray-50 hover:bg-gray-100 px-1.5 py-0.5 rounded transition-colors"
                            >
                                {t.customer_nif}
                                {copied === `nif-${t.id}` ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </button>
                        ) : (
                            <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-semibold">Sem NIF</span>
                        )}
                    </div>
                </div>
            )
        },
        {
            key: 'contact',
            header: 'Contacto',
            render: (t: ConsolidatedTransaction) => t.customer_email ? (
                <div className="flex items-center gap-2 max-w-[180px]">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(t.customer_email!, `email-${t.id}`); }}
                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 truncate group transition-colors"
                        title={t.customer_email}
                    >
                        <span className="truncate">{t.customer_email}</span>
                        {copied === `email-${t.id}` ? <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />}
                    </button>
                </div>
            ) : <span className="text-gray-400 text-xs">—</span>
        },
        {
            key: 'amount',
            header: 'Valor',
            align: 'right' as const,
            render: (t: ConsolidatedTransaction) => (
                <div className="text-right">
                    <span className="font-black text-gray-900 text-sm block">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: t.currency }).format(t.amount)}</span>
                    <div className="flex items-center justify-end gap-1">
                        <span className="text-[10px] text-gray-400 uppercase font-medium">{t.method?.replace('_', ' ') || 'Card'}</span>
                        {t.invoice_sent_at && <span title="Recibo marcado como enviado"><FileText className="w-3 h-3 text-blue-500" /></span>}
                    </div>
                </div>
            )
        },
        {
            key: 'status',
            header: 'Estado',
            render: (t: ConsolidatedTransaction) => {
                const s = t.status.toLowerCase();
                const isPaid = ['paid', 'pago', 'verified', 'succeeded'].includes(s);
                const isPending = ['pending', 'pendente', 'verifying', 'pending_verification'].includes(s);

                return (
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide inline-flex items-center gap-1.5 border ${isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        isPending ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' :
                            'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                        {isPaid ? <CheckCircle className="w-3 h-3" /> :
                            isPending ? <Clock className="w-3 h-3" /> :
                                <AlertCircle className="w-3 h-3" />}
                        {t.status}
                    </div>
                );
            }
        },
        {
            key: 'actions',
            header: 'Ações',
            align: 'right' as const,
            render: (t: ConsolidatedTransaction) => (
                <div className="flex items-center justify-end gap-1">
                    {t.proof_url && (
                        <a href={t.proof_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Comprovativo" onClick={e => e.stopPropagation()}>
                            <FileText className="w-4 h-4" />
                        </a>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setSelectedTransaction(t); }}
                        className="p-1.5 text-gray-400 hover:text-garabandal-dark hover:bg-gray-100 rounded-lg transition-colors"
                        title="Ver Detalhes / Gerir"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-3 text-rose-700 mb-4 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                    <button
                        onClick={fetchData}
                        className="ml-auto text-xs font-bold uppercase tracking-wider bg-white px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors shadow-sm"
                    >
                        Tentar Novamente
                    </button>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Bruto"
                    value={new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(transactions.reduce((acc, t) => acc + t.amount, 0))}
                    icon={TrendingUp}
                    color="indigo"
                    trend="+12% vs mês passado"
                />
                <StatCard
                    title="Pagos / Confirmados"
                    value={transactions.filter(t => ['paid', 'pago', 'verified', 'succeeded'].includes(t.status.toLowerCase())).length.toString()}
                    icon={CheckCircle}
                    color="emerald"
                />
                <StatCard
                    title="Pendentes Verificação"
                    value={transactions.filter(t => ['pending', 'pendente', 'verifying', 'pending_verification'].includes(t.status.toLowerCase())).length.toString()}
                    icon={Clock}
                    color="amber"
                />
                <StatCard
                    title="Recibos Por Enviar"
                    value={transactions.filter(t => !t.invoice_sent_at).length.toString()}
                    icon={FileText}
                    color="rose"
                />
            </div>

            {/* Modern Layout - Filters & Actions */}
            <div className="flex flex-col gap-6">

                {/* Filters Component */}
                <TransactionFilters filters={filters} setFilters={setFilters} />

                {/* Export & Refresh Toolbar */}
                <div className="flex justify-end gap-2">
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar CSV
                    </button>
                    <button
                        onClick={fetchData}
                        className="p-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl hover:text-garabandal-gold hover:border-garabandal-gold transition-all shadow-sm"
                        title="Atualizar Dados"
                    >
                        <Calendar className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Modern Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <AdminTable
                    data={filteredTransactions}
                    columns={columns}
                    isLoading={loading}
                    itemsPerPage={15}
                    actions={(t) => null} // Actions are handled in column for custom layout
                    onRowClick={(item) => setSelectedTransaction(item)}
                />
            </div>

            {/* Detail Modal */}
            {selectedTransaction && (
                <TransactionDetailsModal
                    transaction={selectedTransaction}
                    onClose={() => setSelectedTransaction(null)}
                    onToggleInvoice={handleToggleInvoice}
                />
            )}
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, trend }: { title: string, value: string, icon: any, color: string, trend?: string }) {
    const colorClasses: any = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        rose: 'bg-rose-50 text-rose-600',
    };

    return (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between h-full group hover:border-garabandal-gold/30 transition-colors">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl ${colorClasses[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">{trend}</span>}
            </div>
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
                <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
            </div>
        </div>
    );
}
