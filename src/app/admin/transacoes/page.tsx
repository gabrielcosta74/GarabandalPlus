"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Search, Filter, Eye } from 'lucide-react';

type TransactionRow = {
  id: string; // Transformed for AdminTable
  order_ref: string;
  buyer_name: string | null;
  buyer_email: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_provider: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string;
};

// Adapter for AdminTable matching TransactionRow
interface TransactionTableItem extends TransactionRow { }

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT');

const statusLabel = (status: string) => {
  const normalized = status?.toLowerCase?.() || '';
  if (normalized === 'paid' || normalized === 'pago') return 'Pago';
  if (normalized === 'pending' || normalized === 'pendente') return 'Pendente';
  if (normalized === 'failed') return 'Falhado';
  if (normalized === 'canceled' || normalized === 'cancelado') return 'Cancelado';
  return status || 'Indefinido';
};

export default function AdminTransacoesPage() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    provider: 'all',
    period: '30d',
    search: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch('/api/admin/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao carregar transações.');
      }
      const payload = await res.json();
      const orders = payload.orders || [];
      const mapped = orders.map((order: any) => ({
        id: order.payment_reference || order.order_ref,
        order_ref: order.order_ref,
        buyer_name: order.buyer_name,
        buyer_email: order.buyer_email,
        amount: order.total_amount ?? 0,
        currency: order.currency || 'EUR',
        status: order.status,
        payment_provider: order.payment_provider || null,
        payment_method: order.payment_method || null,
        payment_reference: order.payment_reference || null,
        created_at: order.created_at,
      }));
      setRows(mapped);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar transações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const now = new Date();
    const periodDays =
      filters.period === '7d' ? 7 : filters.period === '90d' ? 90 : filters.period === 'all' ? null : 30;
    const limitDate = periodDays ? new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000) : null;

    return rows.filter((row) => {
      if (limitDate && new Date(row.created_at) < limitDate) return false;

      const normalizedStatus = (row.status || '').toLowerCase();
      if (filters.status !== 'all' && normalizedStatus !== filters.status) return false;

      const provider = (row.payment_provider || '').toLowerCase();
      if (filters.provider !== 'all' && provider !== filters.provider) return false;

      if (search) {
        const haystack = [
          row.order_ref,
          row.buyer_name,
          row.buyer_email,
          row.payment_reference,
          row.payment_method,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [rows, filters]);

  const columns = [
    {
      key: 'payment_reference', header: 'Ref. Pagamento', render: (item: TransactionTableItem) => (
        <span className="font-mono text-gray-600 font-medium">{item.payment_reference || item.order_ref}</span>
      )
    },
    { key: 'created_at', header: 'Data', render: (item: TransactionTableItem) => formatDate(item.created_at) },
    {
      key: 'buyer_name', header: 'Cliente', render: (item: TransactionTableItem) => (
        <div>
          <p className="font-medium text-gray-900">{item.buyer_name || item.buyer_email || 'Cliente'}</p>
          <p className="text-xs text-gray-500 truncate max-w-[150px]">{item.buyer_email}</p>
        </div>
      )
    },
    { key: 'amount', header: 'Valor', align: 'right' as const, render: (item: TransactionTableItem) => <span className="font-bold text-gray-900">{formatCurrency(item.amount, item.currency)}</span> },
    {
      key: 'payment_method', header: 'Método', render: (item: TransactionTableItem) => (
        <div>
          <p className="text-sm font-medium text-gray-700 capitalize">{item.payment_method || '—'}</p>
          <p className="text-[10px] uppercase text-gray-400 font-bold">{item.payment_provider}</p>
        </div>
      )
    },
    {
      key: 'status', header: 'Status', align: 'center' as const, render: (item: TransactionTableItem) => {
        const normalized = (item.status || '').toLowerCase();
        const color = normalized === 'paid' || normalized === 'pago'
          ? 'bg-green-50 text-green-700 border-green-200'
          : normalized === 'pending' || normalized === 'pendente'
            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
            : 'bg-red-50 text-red-700 border-red-200';

        return (
          <span className={`px-2 py-1 rounded-full text-xs font-bold border ${color} uppercase tracking-wider`}>
            {statusLabel(item.status)}
          </span>
        )
      }
    },
  ];

  return (
    <AdminLayout title="Transações da Loja" isLoading={loading}>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
            value={filters.period}
            onChange={(event) => setFilters((prev) => ({ ...prev, period: event.target.value }))}
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="all">Todo o período</option>
          </select>

          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="all">Status: Todos</option>
            <option value="paid">Pagos</option>
            <option value="pending">Pendentes</option>
            <option value="failed">Falhados</option>
            <option value="canceled">Cancelados</option>
          </select>

          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
            value={filters.provider}
            onChange={(event) => setFilters((prev) => ({ ...prev, provider: event.target.value }))}
          >
            <option value="all">Provider: Todos</option>
            <option value="stripe">Stripe</option>
            <option value="reduniq">Reduniq</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
            />
          </div>
          <button
            onClick={load}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            title="Atualizar"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AdminTable
        data={filteredRows}
        columns={columns}
        itemsPerPage={10}
        actions={(item) => (
          <Link
            href="/admin/encomendas"
            className="p-2 text-garabandal-gold hover:bg-garabandal-gold/10 rounded-lg transition-colors"
            title="Ver Encomenda"
          >
            <Eye className="w-4 h-4" />
          </Link>
        )}
      />
      {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
    </AdminLayout>
  );
}
