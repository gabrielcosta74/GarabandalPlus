"use client";

import React, { useEffect, useState, useMemo } from 'react';
import {
    CreditCard,
    Heart,
    Users,
    Plane,
    Search,
    Download,
    ExternalLink,
    CheckCircle,
    Clock,
    AlertCircle,
    FileText,
    TrendingUp,
    Calendar
} from 'lucide-react';
import AdminTable from './AdminTable';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

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
    receipt_required?: boolean;
    items?: Array<{ name: string; qty: number; price: number; total: number }>;
};

export default function TransactionsUnifiedManager() {
    const [transactions, setTransactions] = useState<ConsolidatedTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        category: 'all',
        status: 'all',
        search: ''
    });

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

            if (!res.ok) {
                throw new Error(`Erro na API: ${res.status}`);
            }

            const data = await res.json();
            setTransactions(data.transactions || []);
        } catch (error: any) {
            console.error('Error fetching transactions:', error);
            setError("Não foi possível carregar os dados financeiros. Verifique a sua ligação ou tente mais tarde.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesCategory = filters.category === 'all' || t.category === filters.category;
            const matchesStatus = filters.status === 'all' || t.status.toLowerCase() === filters.status.toLowerCase();
            const searchLower = filters.search.toLowerCase();
            const matchesSearch = !filters.search ||
                t.customer_name?.toLowerCase().includes(searchLower) ||
                t.customer_email?.toLowerCase().includes(searchLower) ||
                t.reference.toLowerCase().includes(searchLower);

            return matchesCategory && matchesStatus && matchesSearch;
        });
    }, [transactions, filters]);

    const categories = [
        { id: 'shop', label: 'Loja', icon: ShoppingBagIcon, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
        { id: 'donation', label: 'Doação', icon: Heart, color: 'text-rose-600 bg-rose-50 border-rose-100' },
        { id: 'quota', label: 'Quota', icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
        { id: 'pilgrimage', label: 'Peregrinação', icon: Plane, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    ];

    const exportToCSV = () => {
        const headers = ['Data', 'Categoria', 'Referência', 'Cliente', 'Email', 'NIF', 'Morada', 'Cidade', 'CP', 'País', 'Valor', 'Moeda', 'Status', 'Método', 'Detalhes/Notas'];
        const rows = filteredTransactions.map(t => [
            format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
            t.category,
            t.reference,
            t.customer_name || '—',
            t.customer_email || '—',
            t.customer_nif || '—',
            t.customer_address || '—',
            t.customer_city || '—',
            t.customer_zip || '—',
            t.customer_country || '—',
            t.amount,
            t.currency,
            t.status,
            t.status,
            t.method || '—',
            t.items ? t.items.map(i => `${i.qty}x ${i.name}`).join(', ') : (t.notes || '')
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(';')).join('\n');
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `transacoes_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns = [
        {
            key: 'created_at',
            header: 'Data',
            render: (t: ConsolidatedTransaction) => (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{format(new Date(t.created_at), 'dd MMM yyyy', { locale: pt })}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{format(new Date(t.created_at), 'HH:mm')}</span>
                </div>
            )
        },
        {
            key: 'category',
            header: 'Tipo',
            render: (t: ConsolidatedTransaction) => {
                const cat = categories.find(c => c.id === t.category);
                const Icon = cat?.icon || CreditCard;
                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${cat?.color}`}>
                        <Icon className="w-3 h-3" />
                        {cat?.label}
                    </div>
                );
            }
        },
        {
            key: 'customer_name',
            header: 'Cliente / Doador',
            render: (t: ConsolidatedTransaction) => (
                <div className="flex flex-col max-w-[200px]">
                    <span className="font-bold text-slate-900 truncate" title={t.customer_name || ''}>{t.customer_name || '—'}</span>
                    <span className="text-xs text-slate-500 truncate" title={t.customer_email || ''}>{t.customer_email || '—'}</span>
                    {t.customer_nif && <span className="text-[10px] text-slate-400 font-mono">NIF: {t.customer_nif}</span>}
                </div>
            )
        },
        {
            key: 'details',
            header: 'Detalhes',
            render: (t: ConsolidatedTransaction) => {
                if (t.category === 'shop' && t.items?.length) {
                    return (
                        <div className="flex flex-col gap-1 max-w-[250px]">
                            {t.items.slice(0, 2).map((item, idx) => (
                                <div key={idx} className="text-xs text-slate-600 truncate flex justify-between">
                                    <span className="truncate mr-2" title={item.name}>{item.qty}x {item.name}</span>
                                </div>
                            ))}
                            {t.items.length > 2 && (
                                <span className="text-[10px] text-slate-400 italic">+{t.items.length - 2} items...</span>
                            )}
                        </div>
                    );
                }
                return <span className="text-xs text-slate-400 italic truncate max-w-[200px]">{t.notes || '—'}</span>;
            }
        },
        {
            key: 'amount',
            header: 'Valor',
            align: 'right' as const,
            render: (t: ConsolidatedTransaction) => (
                <div className="text-right">
                    <span className="font-bold text-slate-900">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: t.currency }).format(t.amount)}</span>
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
                    <div className="flex items-center gap-1.5">
                        {isPaid ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                            isPending ? <Clock className="w-4 h-4 text-amber-500" /> :
                                <AlertCircle className="w-4 h-4 text-rose-500" />}
                        <span className={`text-xs font-bold uppercase tracking-wide ${isPaid ? 'text-emerald-700' : isPending ? 'text-amber-700' : 'text-rose-700'}`}>
                            {t.status}
                        </span>
                    </div>
                );
            }
        },
        {
            key: 'proof_url',
            header: 'Comprovativo',
            align: 'center' as const,
            render: (t: ConsolidatedTransaction) => t.proof_url ? (
                <a href={t.proof_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors inline-flex" title="Ver Comprovativo">
                    <FileText className="w-4 h-4" />
                </a>
            ) : <span className="text-slate-300">—</span>
        }
    ];

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                    <button
                        onClick={fetchData}
                        className="ml-auto text-xs font-bold uppercase tracking-wider bg-rose-100 px-3 py-1 rounded-lg hover:bg-rose-200 transition-colors"
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
                />
                <StatCard
                    title="Pagos"
                    value={transactions.filter(t => ['paid', 'pago', 'verified', 'succeeded'].includes(t.status.toLowerCase())).length.toString()}
                    icon={CheckCircle}
                    color="emerald"
                />
                <StatCard
                    title="Pendentes"
                    value={transactions.filter(t => ['pending', 'pendente', 'verifying', 'pending_verification'].includes(t.status.toLowerCase())).length.toString()}
                    icon={Clock}
                    color="amber"
                />
                <StatCard
                    title="Doações"
                    value={new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(transactions.filter(t => t.category === 'donation').reduce((acc, t) => acc + t.amount, 0))}
                    icon={Heart}
                    color="rose"
                />
            </div>

            {/* Dashboard Controls */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar nome, email, id..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>

                    <select
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-medium text-slate-600 focus:ring-2 focus:ring-garabandal-gold/20"
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    >
                        <option value="all">Todas as Categorias</option>
                        <option value="shop">Loja Online</option>
                        <option value="donation">Doações</option>
                        <option value="quota">Quotas de Sócios</option>
                        <option value="pilgrimage">Peregrinações</option>
                    </select>

                    <select
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-medium text-slate-600 focus:ring-2 focus:ring-garabandal-gold/20"
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    >
                        <option value="all">Todos os Estados</option>
                        <option value="paid">Pagos / Verificados</option>
                        <option value="pending">Pendentes</option>
                        <option value="verifying">Em Verificação</option>
                        <option value="failed">Falhados</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={exportToCSV}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Exportar CSV
                    </button>
                    <button
                        onClick={fetchData}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                        title="Recarregar"
                    >
                        <Calendar className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <AdminTable
                data={filteredTransactions}
                columns={columns}
                isLoading={loading}
                itemsPerPage={15}
                actions={(t) => (
                    <a
                        href={t.details_link}
                        className="p-2 text-slate-600 hover:text-garabandal-gold hover:bg-garabandal-gold/10 rounded-lg transition-all inline-flex"
                        title="Ir para o Gestor"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                )}
            />
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
    const colorClasses: any = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
    };

    return (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
                <p className="text-xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    );
}

function ShoppingBagIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    )
}
