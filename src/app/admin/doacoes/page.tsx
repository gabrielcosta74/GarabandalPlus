"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Search, Filter, CheckCircle, XCircle, Eye, ExternalLink, Heart, Clock, TrendingUp, AlertCircle } from 'lucide-react';

type DonationRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  method: string;
  donor_name: string | null;
  donor_email: string | null;
  donor_nif: string | null;
  description: string | null;
  proof_url: string | null;
  receipt_required: boolean;
  created_at: string;
};

const formatCurrency = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100);

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusLabel = (status: string) => {
  const s = status?.toLowerCase() || '';
  if (s === 'succeeded' || s === 'pago') return 'Sucesso';
  if (s === 'pending_verification') return 'Pendente Verificação';
  if (s === 'pending') return 'Pendente';
  if (s === 'failed') return 'Falhou';
  if (s === 'canceled') return 'Cancelado';
  return status;
};

export default function AdminDonationsPage() {
  const [rows, setRows] = useState<DonationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      if (!supabaseBrowser) throw new Error('Supabase não disponível.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/admin/donations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao carregar doações.');
      const data = await res.json();
      setRows(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    if (!confirm(`Tens a certeza que queres marcar como ${statusLabel(newStatus)}?`)) return;

    setActionLoading(id);
    try {
      if (!supabaseBrowser) throw new Error('Supabase não disponível.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`/api/admin/donations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Erro ao atualizar status.');

      // Refresh local state
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (filters.status !== 'all' && row.status !== filters.status) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const fields = [row.donor_name, row.donor_email, row.id, row.donor_nif].join(' ').toLowerCase();
        if (!fields.includes(search)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const stats = useMemo(() => {
    const succeeded = rows.filter(r => r.status === 'succeeded' || r.status === 'pago');
    const pending = rows.filter(r => r.status === 'pending_verification');
    const totalAmount = succeeded.reduce((acc, r) => acc + (r.amount_cents || 0), 0);
    return {
      totalAmount,
      count: succeeded.length,
      pendingCount: pending.length
    };
  }, [rows]);

  const columns = [
    {
      key: 'created_at', header: 'Data', render: (item: DonationRow) => (
        <div className="text-xs text-gray-500 whitespace-nowrap">{formatDate(item.created_at)}</div>
      )
    },
    {
      key: 'donor_name', header: 'Doador', render: (item: DonationRow) => (
        <div>
          <p className="font-bold text-gray-900">{item.donor_name || 'Anónimo'}</p>
          <p className="text-xs text-gray-500 truncate max-w-[200px]">{item.donor_email}</p>
          {item.donor_nif && <p className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded inline-block">NIF: {item.donor_nif}</p>}
        </div>
      )
    },
    {
      key: 'amount', header: 'Valor', align: 'right' as const, render: (item: DonationRow) => (
        <span className="font-black text-garabandal-dark">{formatCurrency(item.amount_cents, item.currency)}</span>
      )
    },
    {
      key: 'status', header: 'Status', render: (item: DonationRow) => {
        const s = item.status?.toLowerCase();
        let color = 'bg-gray-100 text-gray-600';
        if (s === 'succeeded' || s === 'pago') color = 'bg-green-100 text-green-700';
        if (s === 'pending_verification') color = 'bg-amber-100 text-amber-700 font-bold animate-pulse';
        if (s === 'failed' || s === 'canceled') color = 'bg-red-100 text-red-700';

        return (
          <div className="flex flex-col gap-1 items-start">
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-tighter ${color}`}>
              {statusLabel(item.status)}
            </span>
            {item.receipt_required && <span className="text-[9px] text-garabandal-gold font-bold uppercase ring-1 ring-garabandal-gold/30 px-1 rounded">Recibo Necessário</span>}
          </div>
        );
      }
    },
    {
      key: 'method', header: 'Método', render: (item: DonationRow) => (
        <div className="text-xs">
          <p className="capitalize">{item.method.replace('_', ' ')}</p>
          {item.proof_url && (
            <a href={item.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 mt-1 font-bold">
              <Eye className="w-3 h-3" /> Ver Comprovativo
            </a>
          )}
        </div>
      )
    }
  ];

  return (
    <AdminLayout title="Gestão de Doações" isLoading={loading}>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-garabandal-gold/10 rounded-2xl flex items-center justify-center text-garabandal-gold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Angariado</p>
            <p className="text-2xl font-black text-gray-900">{formatCurrency(stats.totalAmount)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Doadores</p>
            <p className="text-2xl font-black text-gray-900">{stats.count}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
          {stats.pendingCount > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-amber-400 animate-pulse" />}
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Pendentes Verificação</p>
            <p className="text-2xl font-black text-gray-900">{stats.pendingCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">Status: Todos</option>
            <option value="succeeded">Sucesso</option>
            <option value="pending_verification">Pendentes Verificação</option>
            <option value="failed">Falhados</option>
            <option value="canceled">Cancelados</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 min-w-[250px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Procurar doador, NIF ou ID..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none"
            />
          </div>
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <Filter className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <AdminTable
        data={filteredRows}
        columns={columns}
        itemsPerPage={15}
        actions={(item) => (
          <div className="flex items-center gap-1">
            {item.status === 'pending_verification' && (
              <>
                <button
                  onClick={() => updateStatus(item.id, 'succeeded')}
                  disabled={!!actionLoading}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Aprovar Doação"
                >
                  <CheckCircle className={`w-5 h-5 ${actionLoading === item.id ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => updateStatus(item.id, 'failed')}
                  disabled={!!actionLoading}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Rejeitar Doação"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </>
            )}
            {item.description && (
              <button
                onClick={() => alert(`Mensagem do Doador:\n\n${item.description}`)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                title="Ver Mensagem"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      {error && <p className="text-red-500 mt-4 text-center font-bold">{error}</p>}
    </AdminLayout>
  );
}
