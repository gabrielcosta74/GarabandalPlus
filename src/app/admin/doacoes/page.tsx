"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Heart,
  Clock,
  TrendingUp,
  FileCheck,
  FileWarning,
  RefreshCw,
} from 'lucide-react';

type ReceiptStatus = 'pending' | 'sent' | 'not_required';

type DonationRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  method: string;
  donor_name: string | null;
  donor_email: string | null;
  donor_nif: string | null;
  donor_address: string | null;
  donor_city: string | null;
  donor_zip: string | null;
  donor_country: string | null;
  description: string | null;
  proof_url: string | null;
  receipt_required: boolean;
  receipt_status: ReceiptStatus | null;
  invoice_sent_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
};

type StatusFilter = 'all' | 'pending_verification' | 'succeeded' | 'failed' | 'pending' | 'canceled';
type ReceiptFilter = 'all' | 'pending' | 'sent' | 'not_required';
type MethodFilter = 'all' | 'bank_transfer' | 'stripe_card' | 'stripe_apple_pay' | 'pix' | 'mbway' | 'multibanco';

const formatCurrency = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format((cents || 0) / 100);

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusLabel = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'succeeded' || s === 'pago') return 'Aprovada';
  if (s === 'pending_verification') return 'Aguarda revisão';
  if (s === 'pending') return 'Pendente';
  if (s === 'processing') return 'Em processamento';
  if (s === 'failed') return 'Rejeitada';
  if (s === 'canceled') return 'Cancelada';
  return status;
};

const receiptLabel = (status: ReceiptStatus | null, required: boolean) => {
  if (!required) return 'Não aplicável';
  if (status === 'sent') return 'Enviado';
  if (status === 'not_required') return 'Não aplicável';
  return 'Pendente';
};

const methodLabel = (item: DonationRow) => {
  const raw = (item.method || '').toLowerCase();
  const reduniqMethod = String(item.metadata?.reduniq_method || '').toLowerCase();
  if (reduniqMethod.includes('mbway')) return 'MB WAY';
  if (reduniqMethod.includes('multibanco')) return 'Multibanco';
  if (reduniqMethod.includes('pix')) return 'PIX';
  if (reduniqMethod.includes('card')) return 'Cartão (Reduniq)';
  if (raw === 'stripe_card') return 'Cartão';
  if (raw === 'stripe_apple_pay') return 'Apple Pay';
  if (raw === 'bank_transfer') return 'Transferência';
  if (raw === 'pix') return 'PIX';
  return raw.replace(/_/g, ' ') || '—';
};

const getReceiptDataState = (item: DonationRow) => {
  if (!item.receipt_required) {
    return { complete: true, missing: [] as string[] };
  }
  const missing: string[] = [];
  if (!item.donor_name) missing.push('Nome');
  if (!item.donor_email) missing.push('Email');
  if (!item.donor_nif) missing.push('NIF/CPF');
  if (!item.donor_address) missing.push('Morada');
  if (!item.donor_city) missing.push('Cidade');
  if (!item.donor_zip) missing.push('Código Postal');
  if (!item.donor_country) missing.push('País');

  return { complete: missing.length === 0, missing };
};

export default function AdminDonationsPage() {
  const [rows, setRows] = useState<DonationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    status: StatusFilter;
    receipt_status: ReceiptFilter;
    method: MethodFilter;
    search: string;
    with_proof: boolean;
  }>({
    status: 'all',
    receipt_status: 'all',
    method: 'all',
    search: '',
    with_proof: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      if (!supabaseBrowser) throw new Error('Supabase não disponível.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada.');

      const params = new URLSearchParams();
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.receipt_status !== 'all') params.set('receipt_status', filters.receipt_status);
      if (filters.method !== 'all') params.set('method', filters.method);
      if (filters.with_proof) params.set('with_proof', 'true');

      const res = await fetch(`/api/admin/donations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Erro ao carregar doações.');
      }

      const data = await res.json();
      setRows(data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar doações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.receipt_status, filters.method, filters.with_proof]);

  const patchDonation = async (id: string, payload: Record<string, any>) => {
    setActionLoading(id);
    try {
      if (!supabaseBrowser) throw new Error('Supabase não disponível.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada.');

      const res = await fetch(`/api/admin/donations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Falha ao atualizar doação.');
      }

      const body = await res.json();
      const donation = body?.donation;
      if (donation?.id) {
        setRows((prev) => prev.map((r) => (r.id === donation.id ? { ...r, ...donation } : r)));
      } else {
        await load();
      }
    } catch (err: any) {
      alert(err?.message || 'Erro na atualização.');
    } finally {
      setActionLoading(null);
    }
  };

  const approveDonation = async (item: DonationRow) => {
    if (!confirm('Confirmar aprovação desta doação?')) return;
    await patchDonation(item.id, { status: 'succeeded' });
  };

  const rejectDonation = async (item: DonationRow) => {
    const note = prompt('Motivo da rejeição (opcional):') || '';
    if (!confirm('Confirmar rejeição desta doação?')) return;
    await patchDonation(item.id, { status: 'failed', review_note: note });
  };

  const toggleReceiptSent = async (item: DonationRow) => {
    if (!item.receipt_required) {
      await patchDonation(item.id, { receipt_status: 'not_required' });
      return;
    }
    const next = item.receipt_status === 'sent' ? 'pending' : 'sent';
    await patchDonation(item.id, { receipt_status: next });
  };

  const filteredRows = useMemo(() => {
    if (!filters.search) return rows;
    const s = filters.search.trim().toLowerCase();
    return rows.filter((r) =>
      [r.donor_name, r.donor_email, r.donor_nif, r.donor_address, r.donor_city, r.donor_zip, r.donor_country, r.id, r.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(s),
    );
  }, [rows, filters.search]);

  const stats = useMemo(() => {
    const approved = rows.filter((r) => (r.status || '').toLowerCase() === 'succeeded');
    const pendingReview = rows.filter((r) => (r.status || '').toLowerCase() === 'pending_verification');
    const pendingReceipt = rows.filter((r) => r.receipt_required && (r.receipt_status || 'pending') === 'pending');
    return {
      totalAmount: approved.reduce((acc, r) => acc + (r.amount_cents || 0), 0),
      approvedCount: approved.length,
      pendingReviewCount: pendingReview.length,
      pendingReceiptCount: pendingReceipt.length,
    };
  }, [rows]);

  const columns = [
    {
      key: 'created_at',
      header: 'Data',
      render: (item: DonationRow) => <div className="text-xs text-gray-500 whitespace-nowrap">{formatDate(item.created_at)}</div>,
    },
    {
      key: 'donor',
      header: 'Doador',
      render: (item: DonationRow) => (
        <div>
          <p className="font-bold text-gray-900">{item.donor_name || 'Anónimo'}</p>
          <p className="text-xs text-gray-500 truncate max-w-[220px]">{item.donor_email || '—'}</p>
          {item.donor_nif && <p className="text-[10px] bg-blue-50 text-blue-700 px-1.5 rounded inline-block mt-1">NIF: {item.donor_nif}</p>}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      align: 'right' as const,
      render: (item: DonationRow) => <span className="font-black text-garabandal-dark">{formatCurrency(item.amount_cents, item.currency)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item: DonationRow) => {
        const s = (item.status || '').toLowerCase();
        let color = 'bg-gray-100 text-gray-700';
        if (s === 'pending_verification') color = 'bg-amber-100 text-amber-700';
        if (s === 'succeeded') color = 'bg-green-100 text-green-700';
        if (s === 'failed' || s === 'canceled') color = 'bg-red-100 text-red-700';

        return (
          <div className="space-y-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold ${color}`}>
              {statusLabel(item.status)}
            </span>
            <p className="text-[10px] text-gray-500">Rev.: {formatDate(item.reviewed_at)}</p>
          </div>
        );
      },
    },
    {
      key: 'receipt',
      header: 'Recibo',
      render: (item: DonationRow) => {
        const label = receiptLabel(item.receipt_status, item.receipt_required);
        const sent = label === 'Enviado';
        const receiptData = getReceiptDataState(item);
        return (
          <div className="space-y-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold ${sent ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
              {label}
            </span>
            <p className="text-[10px] text-gray-500">{formatDate(item.invoice_sent_at)}</p>
            {item.receipt_required && (
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${receiptData.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
              >
                {receiptData.complete ? 'Dados completos' : 'Dados incompletos'}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'receipt_data',
      header: 'Dados p/Recibo',
      render: (item: DonationRow) => {
        if (!item.receipt_required) {
          return <span className="text-xs text-gray-400">Não solicitado</span>;
        }
        const receiptData = getReceiptDataState(item);
        return (
          <div className="text-xs space-y-1">
            <p className="text-gray-700">
              {item.donor_address || '—'}{item.donor_city ? `, ${item.donor_city}` : ''}
            </p>
            <p className="text-gray-500">
              {(item.donor_zip || '—')}{item.donor_country ? ` • ${item.donor_country}` : ''}
            </p>
            {!receiptData.complete && (
              <p className="text-[10px] text-amber-700 font-semibold">
                Falta: {receiptData.missing.slice(0, 2).join(', ')}{receiptData.missing.length > 2 ? '...' : ''}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'method',
      header: 'Método / Comprovativo',
      render: (item: DonationRow) => (
        <div className="text-xs">
          <p className="font-medium">{methodLabel(item)}</p>
          {item.proof_url ? (
            <a
              href={item.proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1 mt-1 font-bold"
            >
              <Eye className="w-3 h-3" /> Ver comprovativo
            </a>
          ) : (
            <span className="text-gray-400">Sem comprovativo</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Gestão de Doações" isLoading={loading}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-garabandal-gold/10 rounded-xl flex items-center justify-center text-garabandal-gold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Total Aprovado</p>
            <p className="text-xl font-black text-gray-900">{formatCurrency(stats.totalAmount)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Doações Aprovadas</p>
            <p className="text-xl font-black text-gray-900">{stats.approvedCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Aguardam Revisão</p>
            <p className="text-xl font-black text-gray-900">{stats.pendingReviewCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <FileWarning className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Recibos Pendentes</p>
            <p className="text-xl font-black text-gray-900">{stats.pendingReceiptCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap gap-3 items-center">
        <select
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none"
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as StatusFilter }))}
        >
          <option value="all">Estado: Todos</option>
          <option value="pending_verification">Aguardam revisão</option>
          <option value="succeeded">Aprovadas</option>
          <option value="failed">Rejeitadas</option>
          <option value="pending">Pendentes</option>
          <option value="canceled">Canceladas</option>
        </select>

        <select
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none"
          value={filters.receipt_status}
          onChange={(e) => setFilters((prev) => ({ ...prev, receipt_status: e.target.value as ReceiptFilter }))}
        >
          <option value="all">Recibo: Todos</option>
          <option value="pending">Recibo pendente</option>
          <option value="sent">Recibo enviado</option>
          <option value="not_required">Recibo não aplicável</option>
        </select>

        <select
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none"
          value={filters.method}
          onChange={(e) => setFilters((prev) => ({ ...prev, method: e.target.value as MethodFilter }))}
        >
          <option value="all">Método: Todos</option>
          <option value="bank_transfer">Transferência</option>
          <option value="stripe_card">Cartão</option>
          <option value="stripe_apple_pay">Apple Pay</option>
          <option value="pix">PIX</option>
          <option value="mbway">MB WAY</option>
          <option value="multibanco">Multibanco</option>
        </select>

        <label className="text-xs font-semibold text-gray-600 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50">
          <input
            type="checkbox"
            checked={filters.with_proof}
            onChange={(e) => setFilters((prev) => ({ ...prev, with_proof: e.target.checked }))}
          />
          Apenas com comprovativo
        </label>

        <div className="relative min-w-[240px] flex-1 ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar por doador, email, NIF ou ID..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none"
          />
        </div>

        <button
          onClick={load}
          className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      <AdminTable
        data={filteredRows}
        columns={columns}
        itemsPerPage={15}
        actions={(item: DonationRow) => (
          <div className="flex items-center gap-1">
            {(item.status || '').toLowerCase() === 'pending_verification' && (
              <>
                <button
                  onClick={() => approveDonation(item)}
                  disabled={!!actionLoading}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Aprovar doação"
                >
                  <CheckCircle className={`w-5 h-5 ${actionLoading === item.id ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => rejectDonation(item)}
                  disabled={!!actionLoading}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Rejeitar doação"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </>
            )}

            <button
              onClick={() => toggleReceiptSent(item)}
              disabled={!!actionLoading}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title={item.receipt_status === 'sent' ? 'Marcar recibo como pendente' : 'Marcar recibo como enviado'}
            >
              {item.receipt_status === 'sent' ? <FileCheck className="w-5 h-5" /> : <FileWarning className="w-5 h-5" />}
            </button>

            {item.description && (
              <button
                onClick={() => alert(`Mensagem do doador:\n\n${item.description}`)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Ver mensagem"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}

            {item.receipt_required && (
              <button
                onClick={() =>
                  alert(
                    [
                      'Dados para emissão de recibo',
                      '',
                      `Nome: ${item.donor_name || '—'}`,
                      `Email: ${item.donor_email || '—'}`,
                      `NIF/CPF: ${item.donor_nif || '—'}`,
                      `Morada: ${item.donor_address || '—'}`,
                      `Cidade: ${item.donor_city || '—'}`,
                      `Código Postal: ${item.donor_zip || '—'}`,
                      `País: ${item.donor_country || '—'}`,
                    ].join('\n'),
                  )
                }
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Ver dados do recibo"
              >
                <FileCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      {error && <p className="text-red-600 mt-4 text-center font-bold">{error}</p>}
    </AdminLayout>
  );
}
