"use client";

import React, { useEffect, useState, useMemo } from 'react';
import {
    Heart,
    Users,
    Plane,
    Download,
    Copy,
    Check,
    ShoppingBag,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    AlertCircle,
    FileText,
    Inbox,
    CheckCircle2,
    Clock3,
    ListFilter,
} from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import TransactionFilters, {
    TransactionFiltersState,
    DEFAULT_TRANSACTION_FILTERS,
    resolveDateRange,
} from './TransactionFilters';
import TransactionDetailsModal, { type FactptDocumentSummary } from './TransactionDetailsModal';
import StatCard from './ui/StatCard';
import { TONE_BADGE, type Tone } from './ui/tones';

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
    has_nif?: boolean;
    /** Descrição concreta: qual peregrinação, que artigos, que quota. */
    subject?: string | null;
    /** Detalhe secundário (ex.: Sinal, Prestação, nº de artigos). */
    subject_detail?: string | null;
    /** Referência que enviamos ao gateway (orderRef). */
    external_reference?: string | null;
    /** ID da transação devolvido pela API Reduniq. */
    gateway_transaction_id?: string | null;
    /** Token de pagamento Reduniq (uso técnico / reconciliação). */
    payment_token?: string | null;
    /** Total efetivamente cobrado no gateway (base + taxa), quando difere do valor base. */
    charged_amount?: number | null;
    /** True quando a data é o período que o pagamento cobre, não a data real do pagamento. */
    date_is_approximate?: boolean;
    /** Descrição enviada ao Reduniq no checkout — é o texto que aparece no backoffice. */
    gateway_description?: string | null;
    /** Documento fiscal oficial. O invoice_sent_at antigo não é fonte de verdade. */
    factpt_document?: FactptDocumentSummary | null;
    legacy_invoice_sent_at?: string | null;
    manual_fiscal_record?: boolean;
};

type SortKey = 'created_at' | 'amount';
type SortDirection = 'asc' | 'desc';

const CATEGORIES = {
    shop: { label: 'Loja', icon: ShoppingBag, dot: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700' },
    donation: { label: 'Doação', icon: Heart, dot: 'bg-rose-500', soft: 'bg-rose-50 text-rose-700' },
    quota: { label: 'Quota', icon: Users, dot: 'bg-teal-500', soft: 'bg-teal-50 text-teal-700' },
    pilgrimage: { label: 'Peregrinação', icon: Plane, dot: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700' },
} as const;

const PAID_STATUSES = ['paid', 'pago', 'verified', 'succeeded'];
const PENDING_STATUSES = ['pending', 'pendente', 'verifying', 'pending_verification'];

const statusGroup = (status: string): 'paid' | 'pending' | 'failed' => {
    const s = String(status || '').toLowerCase();
    if (PAID_STATUSES.includes(s)) return 'paid';
    if (PENDING_STATUSES.includes(s)) return 'pending';
    return 'failed';
};

const money = (value: number, currency = 'EUR') =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

export default function TransactionsUnifiedManager() {
    const [transactions, setTransactions] = useState<ConsolidatedTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [selectedTransaction, setSelectedTransaction] = useState<ConsolidatedTransaction | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const [filters, setFilters] = useState<TransactionFiltersState>(DEFAULT_TRANSACTION_FILTERS);
    const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'created_at', direction: 'desc' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 1600);
    };

    const fetchData = async () => {
        if (!supabaseBrowser) return;
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) {
                setError('Sessão expirada. Por favor, faça login novamente.');
                return;
            }

            const res = await fetch('/api/admin/transactions/consolidated', {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
            const data = await res.json();
            const nextTransactions = data.transactions || [];
            setTransactions(nextTransactions);
            setSelectedTransaction(current => {
                if (!current) return null;
                return nextTransactions.find((transaction: ConsolidatedTransaction) =>
                    transaction.id === current.id && transaction.category === current.category
                ) || current;
            });
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Error fetching transactions:', err);
            setError('Não foi possível carregar os dados financeiros.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 120000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => { setPage(1); }, [filters, sort, pageSize]);

    // Tudo menos o filtro de estado — base dos cartões de resumo, para o número de
    // falhados continuar visível mesmo quando estão escondidos da tabela.
    const scopedTransactions = useMemo(() => {
        const { from, to } = resolveDateRange(filters);
        const searchLower = filters.search.trim().toLowerCase();

        return transactions.filter(t => {
            if (filters.category !== 'all' && t.category !== filters.category) return false;
            if (filters.fiscalStatus !== 'all') {
                const fiscalStatus = t.factpt_document?.status
                    || (t.manual_fiscal_record || t.legacy_invoice_sent_at
                        ? 'manual'
                        : 'unregistered');
                if (fiscalStatus !== filters.fiscalStatus) return false;
            }
            if (filters.fiscalSeries !== 'all' && t.factpt_document?.series_code !== filters.fiscalSeries) return false;

            const hasNif = typeof t.customer_nif === 'string' && t.customer_nif.trim().length > 0;
            if (filters.nif === 'with_nif' && !hasNif) return false;
            if (filters.nif === 'without_nif' && hasNif) return false;

            if (from || to) {
                const ts = new Date(t.created_at).getTime();
                if (!Number.isFinite(ts)) return false;
                if (from && ts < from.getTime()) return false;
                if (to && ts > to.getTime()) return false;
            }

            if (searchLower) {
                const haystack = [
                    t.customer_name,
                    t.customer_email,
                    t.customer_nif,
                    t.subject,
                    t.gateway_description,
                    t.reference,
                    t.external_reference,
                    t.gateway_transaction_id,
                    t.payment_token,
                    t.factpt_document?.factpt_number,
                    t.factpt_document?.series_code,
                ];
                if (!haystack.some(v => v?.toLowerCase().includes(searchLower))) return false;
            }

            return true;
        });
    }, [transactions, filters]);

    const filteredTransactions = useMemo(() => scopedTransactions.filter(t => {
        const group = statusGroup(t.status);
        if (filters.status === 'all') return true;
        if (filters.status === 'active') return group !== 'failed';
        return group === filters.status;
    }), [scopedTransactions, filters.status]);

    const sortedTransactions = useMemo(() => {
        const factor = sort.direction === 'asc' ? 1 : -1;
        return [...filteredTransactions].sort((a, b) => {
            if (sort.key === 'amount') return (a.amount - b.amount) * factor;
            const aTs = new Date(a.created_at).getTime();
            const bTs = new Date(b.created_at).getTime();
            return ((Number.isFinite(aTs) ? aTs : 0) - (Number.isFinite(bTs) ? bTs : 0)) * factor;
        });
    }, [filteredTransactions, sort]);

    const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageRows = sortedTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const summary = useMemo(() => {
        let received = 0;
        let pendingAmount = 0;
        let paidCount = 0;
        let pendingCount = 0;
        let failedCount = 0;

        for (const t of scopedTransactions) {
            const group = statusGroup(t.status);
            if (group === 'paid') { received += t.amount; paidCount += 1; }
            else if (group === 'pending') { pendingAmount += t.amount; pendingCount += 1; }
            else failedCount += 1;
        }

        return { received, pendingAmount, paidCount, pendingCount, failedCount };
    }, [scopedTransactions]);

    const toggleSort = (key: SortKey) => {
        setSort(prev => prev.key === key
            ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            : { key, direction: 'desc' });
    };

    const exportToCSV = () => {
        const headers = [
            'Data', 'Data Aproximada', 'Categoria', 'Descricao', 'Detalhe', 'Descricao Reduniq',
            'Referencia', 'ID Transacao', 'Token', 'Nome', 'Email', 'NIF',
            'Valor Base', 'Total Cobrado', 'Moeda', 'Provider', 'Metodo', 'Estado',
            'Ambiente FACT', 'Estado FACT', 'Serie FACT', 'Tipo Documento',
            'Numero FACT', 'Emitido Em', 'Email Fiscal Enviado Em'
        ];
        const rows = sortedTransactions.map(t => [
            format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
            t.date_is_approximate ? 'Sim' : 'Nao',
            CATEGORIES[t.category]?.label || t.category,
            t.subject || '-',
            t.subject_detail || '-',
            t.gateway_description || '-',
            t.external_reference || t.reference,
            t.gateway_transaction_id || '-',
            t.payment_token || '-',
            t.customer_name || '-',
            t.customer_email || '-',
            t.customer_nif || '-',
            t.amount,
            typeof t.charged_amount === 'number' ? t.charged_amount : t.amount,
            t.currency,
            t.provider || '-',
            t.method || '-',
            t.status,
            t.factpt_document?.environment || '-',
            t.factpt_document?.status
                || (t.manual_fiscal_record || t.legacy_invoice_sent_at
                    ? 'emitida_manualmente'
                    : 'sem_registo'),
            t.factpt_document?.series_code || '-',
            t.factpt_document?.document_type || '-',
            t.factpt_document?.factpt_number || '-',
            t.factpt_document?.issued_at || '-',
            t.factpt_document?.email_sent_at || '-',
        ]);

        // Descrições podem conter ";" ou aspas (nomes de artigos, títulos de viagens).
        const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
        const csvContent = [headers, ...rows].map(row => row.map(escapeCell).join(';')).join('\n');
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transacoes_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const showSkeleton = loading && transactions.length === 0;

    return (
        <div className="space-y-5">
            {/* Cabeçalho de página */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-[19px] font-bold tracking-tight text-slate-900">Transações</h2>
                <div className="ml-auto flex items-center gap-3">
                    {lastUpdated && (
                        <span className="hidden text-[13px] text-slate-400 sm:inline">
                            Atualizado às {format(lastUpdated, 'HH:mm', { locale: pt })}
                        </span>
                    )}
                    <button
                        onClick={fetchData}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 text-[14px] font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.25} />
                        Atualizar
                    </button>
                    <button
                        onClick={exportToCSV}
                        disabled={sortedTransactions.length === 0}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Download className="h-4 w-4" strokeWidth={2.25} />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-rose-700">
                    <AlertCircle className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
                    <p className="text-[14px] font-medium">{error}</p>
                    <button
                        onClick={fetchData}
                        className="ml-auto rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[13px] font-semibold transition-colors hover:bg-rose-100"
                    >
                        Tentar novamente
                    </button>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <StatCard
                    label="Recebido"
                    value={money(summary.received)}
                    detail={`${summary.paidCount} ${summary.paidCount === 1 ? 'transação' : 'transações'}`}
                    icon={CheckCircle2}
                    tone="emerald"
                    loading={showSkeleton}
                />
                <StatCard
                    label="Por confirmar"
                    value={money(summary.pendingAmount)}
                    detail={`${summary.pendingCount} pendente${summary.pendingCount === 1 ? '' : 's'}`}
                    icon={Clock3}
                    tone={summary.pendingCount > 0 ? 'amber' : 'slate'}
                    loading={showSkeleton}
                />
                <StatCard
                    label="Falhados"
                    value={String(summary.failedCount)}
                    detail={filters.status === 'active' ? 'escondidos por omissão' : 'fora do total recebido'}
                    icon={AlertCircle}
                    tone={summary.failedCount > 0 ? 'rose' : 'slate'}
                    loading={showSkeleton}
                />
                <StatCard
                    label="Na tabela"
                    value={String(filteredTransactions.length)}
                    detail={`de ${transactions.length} carregados`}
                    icon={ListFilter}
                    tone="slate"
                    loading={showSkeleton}
                />
            </div>

            <TransactionFilters filters={filters} setFilters={setFilters} />

            {/* Tabela */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                            <tr className="border-b border-slate-100">
                                <SortableHeader label="Data" sortKey="created_at" sort={sort} onSort={toggleSort} />
                                <Header label="Origem / Descrição" />
                                <Header label="Entidade" />
                                <Header label="Referência" />
                                <SortableHeader label="Valor" sortKey="amount" sort={sort} onSort={toggleSort} align="right" />
                                <Header label="Estado" />
                                <Header label="Fatura" />
                                <Header label="" align="right" />
                            </tr>
                        </thead>
                        <tbody>
                            {showSkeleton ? (
                                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                            <Inbox className="h-6 w-6" strokeWidth={1.75} />
                                        </span>
                                        <p className="text-[16px] font-semibold text-slate-900">Nenhuma transação corresponde aos filtros</p>
                                        <button
                                            onClick={() => setFilters(DEFAULT_TRANSACTION_FILTERS)}
                                            className="mt-3 inline-flex h-10 items-center rounded-xl bg-slate-900 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-slate-800"
                                        >
                                            Limpar filtros
                                        </button>
                                    </td>
                                </tr>
                            ) : pageRows.map(t => {
                                const cat = CATEGORIES[t.category];
                                const group = statusGroup(t.status);
                                const charged = typeof t.charged_amount === 'number' ? t.charged_amount : null;
                                const chargedDiffers = charged !== null && Math.abs(charged - t.amount) >= 0.01;

                                return (
                                    <tr
                                        key={`${t.category}-${t.id}`}
                                        onClick={() => setSelectedTransaction(t)}
                                        className="group cursor-pointer border-b border-slate-100 transition-colors duration-200 last:border-0 hover:bg-slate-50/80"
                                    >
                                        <td className="whitespace-nowrap px-5 py-3.5 align-middle">
                                            <div className="flex items-center gap-1 text-[14.5px] font-semibold text-slate-900 tabular-nums">
                                                {t.date_is_approximate && (
                                                    <span
                                                        className="text-slate-400"
                                                        title="Data aproximada: é o período que a quota cobre, não a data em que o pagamento entrou (registo importado do sistema antigo)."
                                                    >
                                                        ≈
                                                    </span>
                                                )}
                                                {format(new Date(t.created_at), 'dd/MM/yy')}
                                            </div>
                                            {!t.date_is_approximate && (
                                                <div className="mt-0.5 text-[13px] text-slate-500 tabular-nums">
                                                    {format(new Date(t.created_at), 'HH:mm', { locale: pt })}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-5 py-3.5 align-middle">
                                            <div className="flex max-w-[300px] items-start gap-2.5">
                                                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${cat?.dot}`} />
                                                <div className="min-w-0">
                                                    <div className="truncate text-[14.5px] font-semibold text-slate-900" title={t.subject || ''}>
                                                        {t.subject || cat?.label}
                                                    </div>
                                                    <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-500">
                                                        <span>{cat?.label}</span>
                                                        {t.subject_detail && (
                                                            <>
                                                                <span className="text-slate-300">·</span>
                                                                <span>{t.subject_detail}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-5 py-3.5 align-middle">
                                            <div className="max-w-[190px]">
                                                <div className="truncate text-[14.5px] font-medium text-slate-800" title={t.customer_name || ''}>
                                                    {t.customer_name || 'Anónimo'}
                                                </div>
                                                <div className="mt-0.5 text-[13px] text-slate-500">
                                                    {t.customer_nif || 'sem NIF'}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-5 py-3.5 align-middle">
                                            <CopyValue
                                                value={t.external_reference || t.reference}
                                                copyKey={`ref-${t.id}`}
                                                copied={copied}
                                                onCopy={handleCopy}
                                            />
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-3.5 text-right align-middle">
                                            <div className="text-[15px] font-semibold text-slate-900 tabular-nums">
                                                {money(t.amount, t.currency)}
                                            </div>
                                            {chargedDiffers ? (
                                                <div
                                                    className="mt-0.5 text-[13px] text-amber-600 tabular-nums"
                                                    title="Valor debitado ao cliente no gateway, com taxa incluída."
                                                >
                                                    {money(charged!, t.currency)} c/ taxa
                                                </div>
                                            ) : (
                                                <div className="mt-0.5 text-[13px] text-slate-500">{t.provider || '—'}</div>
                                            )}
                                        </td>

                                        <td className="px-5 py-3.5 align-middle">
                                            <StatusPill group={group} label={t.status} />
                                        </td>

                                        <td className="px-5 py-3.5 align-middle">
                                            <FiscalPill
                                                document={t.factpt_document}
                                                legacySentAt={t.legacy_invoice_sent_at}
                                                manuallyIssued={t.manual_fiscal_record}
                                            />
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-3.5 text-right align-middle">
                                            <div className="flex items-center justify-end gap-0.5">
                                                {t.proof_url && (
                                                    <a
                                                        href={t.proof_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={e => e.stopPropagation()}
                                                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                                                        title="Ver comprovativo"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </a>
                                                )}
                                                <ChevronRight className="h-[18px] w-[18px] text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                    <div className="flex items-center gap-2.5 text-[13px] text-slate-500">
                        <select
                            value={pageSize}
                            onChange={e => setPageSize(Number(e.target.value))}
                            className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300"
                        >
                            {[25, 50, 100, 250].map(n => <option key={n} value={n}>{n} / página</option>)}
                        </select>
                        {sortedTransactions.length > 0 && (
                            <span className="tabular-nums">
                                {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedTransactions.length)} de {sortedTransactions.length}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="px-2 text-[13px] font-semibold text-slate-600 tabular-nums">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {selectedTransaction && (
                <TransactionDetailsModal
                    transaction={selectedTransaction}
                    onClose={() => setSelectedTransaction(null)}
                    onFactptChanged={fetchData}
                />
            )}
        </div>
    );
}

function Header({ label, align }: { label: string; align?: 'right' }) {
    return (
        <th className={`px-5 py-3 text-[12px] font-bold uppercase tracking-[0.07em] text-slate-400 ${align === 'right' ? 'text-right' : 'text-left'}`}>
            {label}
        </th>
    );
}

function SortableHeader({ label, sortKey, sort, onSort, align }: {
    label: string;
    sortKey: SortKey;
    sort: { key: SortKey; direction: SortDirection };
    onSort: (key: SortKey) => void;
    align?: 'right';
}) {
    const active = sort.key === sortKey;
    return (
        <th className={`px-5 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={`inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.07em] transition-colors ${active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
            >
                {label}
                {active
                    ? (sort.direction === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
                    : <ChevronDown className="h-3.5 w-3.5 text-slate-300" />}
            </button>
        </th>
    );
}

function StatusPill({ group, label }: { group: 'paid' | 'pending' | 'failed'; label: string }) {
    const tone: Tone = group === 'paid' ? 'emerald' : group === 'pending' ? 'amber' : 'slate';
    const dot = group === 'paid' ? 'bg-emerald-500' : group === 'pending' ? 'bg-amber-500' : 'bg-slate-400';

    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold capitalize ring-1 ring-inset ${TONE_BADGE[tone]}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {label}
        </span>
    );
}

function FiscalPill({
    document,
    legacySentAt,
    manuallyIssued,
}: {
    document?: FactptDocumentSummary | null;
    legacySentAt?: string | null;
    manuallyIssued?: boolean;
}) {
    if (!document) {
        const isManual = Boolean(manuallyIssued || legacySentAt);
        return (
            <span
                title={isManual
                    ? 'Documento emitido manualmente na FACT.pt antes da integração automática.'
                    : 'Sem documento FACT.pt associado.'}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset ${
                    isManual ? TONE_BADGE.emerald : TONE_BADGE.slate
                }`}
            >
                <span className={`h-1.5 w-1.5 rounded-full ${
                    isManual ? 'bg-emerald-500' : 'bg-slate-300'
                }`} />
                {isManual ? 'Emitida manualmente' : 'Sem registo'}
            </span>
        );
    }

    const styles: { label: string; tone: Tone; dot: string } = {
        awaiting_approval: { label: 'Por aprovar', tone: 'amber' as Tone, dot: 'bg-amber-500' },
        pending: { label: 'Por emitir', tone: 'amber' as Tone, dot: 'bg-amber-500' },
        needs_data: { label: 'Requer dados', tone: 'amber' as Tone, dot: 'bg-amber-500' },
        processing: { label: 'A processar', tone: 'sky' as Tone, dot: 'bg-sky-500' },
        issued: { label: document.factpt_number || 'Emitida', tone: 'emerald' as Tone, dot: 'bg-emerald-500' },
        failed: { label: 'Erro na emissão', tone: 'rose' as Tone, dot: 'bg-rose-500' },
        email_failed: { label: 'Email por enviar', tone: 'rose' as Tone, dot: 'bg-rose-500' },
    }[document.status] || { label: document.status, tone: 'slate' as Tone, dot: 'bg-slate-400' };

    return (
        <div className="flex flex-col items-start gap-1">
            <span className={`inline-flex max-w-[160px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset ${TONE_BADGE[styles.tone]}`}>
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${styles.dot}`} />
                <span className="truncate">{styles.label}</span>
            </span>
            <span className="pl-1 text-[12px] text-slate-400">{document.series_code}</span>
        </div>
    );
}

function CopyValue({ value, copyKey, copied, onCopy }: {
    value: string;
    copyKey: string;
    copied: string | null;
    onCopy: (text: string, id: string) => void;
}) {
    return (
        <button
            type="button"
            onClick={e => { e.stopPropagation(); onCopy(value, copyKey); }}
            title={`${value} — clique para copiar`}
            className="flex w-full max-w-[190px] items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-200/70"
        >
            <span className="truncate text-[13px] text-slate-500">{value}</span>
            {copied === copyKey
                ? <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                : <Copy className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-slate-300" />}
        </button>
    );
}

function SkeletonRow() {
    return (
        <tr className="border-b border-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
                <td key={i} className="px-5 py-4">
                    <div className="h-3 animate-pulse rounded bg-slate-100" style={{ width: `${[45, 85, 70, 60, 50, 55, 55, 20][i]}%` }} />
                </td>
            ))}
        </tr>
    );
}
