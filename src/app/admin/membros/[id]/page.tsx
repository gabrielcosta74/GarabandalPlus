"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { normalizeQuotaStatus } from '../../../../lib/membership-status';
import {
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  CheckCircle,
  XCircle,
  Shield,
  Hash,
  Save,
  Send,
  FileText,
  ArrowLeft,
  PlusCircle,
  Settings,
  Trash2,
  Lock,
  Unlock
} from 'lucide-react';

type MemberDetail = {
  id: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  address?: string | null;
  postal_code?: string | null;
  country?: string | null;
  nif?: string | null;
  numero_socio?: number | null;
  estado_quota?: string | null;
  proxima_quota?: string | null;
  tipo_subscricao?: string | null;
  is_membro?: boolean | null;
  data_adesao?: string | null;
};

type PaymentRow = {
  id: string;
  valor: number | null;
  estado: string | null;
  metodo_pagamento: string | null;
  data_pagamento: string | null;
  created_at: string | null;
  external_reference: string | null;
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('pt-PT') : '—');

const getTenureLabel = (value?: string | null) => {
  if (!value) return '—';
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return '—';
  const today = new Date();
  let months =
    (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) {
    months -= 1;
  }
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return `${years}a ${remaining}m`;
};

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);

export default function AdminMemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = typeof params?.id === 'string' ? params.id : '';
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'resumo' | 'quota' | 'pagamentos' | 'contactos' | 'settings'>('resumo');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    estado_quota: '',
    proxima_quota: '',
    tipo_subscricao: '',
    numero_socio: '',
    is_membro: false,
    data_adesao: '',
    nome: '',
    nif: '',
    telefone: '',
    address: '',
    postal_code: '',
    country: '',
  });

  // Manual Payment State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '25',
    date: new Date().toISOString().slice(0, 10),
    method: 'transfer',
    type: 'quota', // 'quota' | 'donation'
    notes: '',
    update_quota: true,
  });

  useEffect(() => {
    const load = async () => {
      if (!memberId) return;
      setError(null);
      if (!supabaseBrowser) {
        setError('Supabase nao configurado no browser.');
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        const token = data.session?.access_token;
        if (!token || !memberId) throw new Error('Sessao invalida.');
        const res = await fetch(`/api/admin/members/${memberId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('[admin/membros] fetch', { memberId, status: res.status });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || 'Falha ao carregar o membro.');
        }
        const payload = await res.json();
        setMember(payload.member);
        setPayments(payload.payments || []);
        setFormState({
          estado_quota: payload.member?.estado_quota || '',
          proxima_quota: payload.member?.proxima_quota || '',
          tipo_subscricao: payload.member?.tipo_subscricao || '',
          numero_socio: payload.member?.numero_socio ? String(payload.member.numero_socio) : '',
          is_membro: !!payload.member?.is_membro,
          data_adesao: payload.member?.data_adesao || '',
          nome: payload.member?.nome || '',
          nif: payload.member?.nif || '',
          telefone: payload.member?.telefone || '',
          address: payload.member?.address || '',
          postal_code: payload.member?.postal_code || '',
          country: payload.member?.country || '',
        });
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar o membro.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [memberId]);

  const paymentSummary = useMemo(() => {
    const totalPaid = payments
      .filter((row) => (row.estado || '').toLowerCase() === 'pago')
      .reduce((sum, row) => sum + Number(row.valor || 0), 0);
    return { totalPaid };
  }, [payments]);

  const runAction = async (action: 'mark_paid' | 'resend_receipt' | 'resend_diploma') => {
    if (action === 'mark_paid') {
      const confirmed = window.confirm('Confirmar marcar quota como paga? Esta ação envia recibo ao membro.');
      if (!confirmed) return;
    }
    if (action === 'resend_diploma') {
      const confirmed = window.confirm('Reenviar diploma para este membro?');
      if (!confirmed) return;
    }
    if (action === 'resend_receipt') {
      const confirmed = window.confirm('Reenviar recibo da última quota?');
      if (!confirmed) return;
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado.');
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token || !memberId) throw new Error('Sessao invalida.');
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao executar acao.');
      }
      setActionMessage('Acao executada com sucesso.');
    } catch (err: any) {
      setActionMessage(err?.message || 'Falha ao executar acao.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSave = async () => {
    const confirmed = window.confirm('Guardar alterações do membro?');
    if (!confirmed) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado.');
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token || !memberId) throw new Error('Sessao invalida.');
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          estado_quota: formState.estado_quota || null,
          proxima_quota: formState.proxima_quota || null,
          tipo_subscricao: formState.tipo_subscricao || null,
          numero_socio: formState.numero_socio ? Number(formState.numero_socio) : null,
          is_membro: formState.is_membro,
          data_adesao: formState.data_adesao || null,
          nome: formState.nome,
          nif: formState.nif,
          telefone: formState.telefone,
          address: formState.address,
          postal_code: formState.postal_code,
          country: formState.country,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao guardar.');
      }
      const payload = await res.json();
      setMember(payload.member);
      setActionMessage('Dados atualizados.');
    } catch (err: any) {
      setActionMessage(err?.message || 'Falha ao guardar.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionMessage(null);

    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado.');
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token || !memberId) throw new Error('Sessao invalida.');

      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'register_payment',
          amount: Number(paymentForm.amount),
          date: paymentForm.date,
          method: paymentForm.method,
          notes: `${paymentForm.type === 'donation' ? '[DOAÇÃO] ' : ''}${paymentForm.notes}`,
          update_quota: paymentForm.type === 'quota' && paymentForm.update_quota,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao registar pagamento.');
      }

      // Refresh data
      const refreshRes = await fetch(`/api/admin/members/${memberId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await refreshRes.json();
      if (payload.member) setMember(payload.member);
      if (payload.payments) setPayments(payload.payments);

      setActionMessage('Pagamento registado com sucesso.');
      setIsPaymentModalOpen(false);
      // Reset form slightly but keep defaults
      setPaymentForm(prev => ({ ...prev, notes: '' }));

    } catch (err: any) {
      alert(err.message || 'Erro ao registar pagamento.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm('Tem a certeza que deseja revogar o estatuto de membro? O utilizador perderá o acesso a áreas exclusivas, mas o histórico manter-se-á.')) return;
    setActionLoading(true);
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sessao invalida.');

      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'revoke_status' }),
      });
      if (!res.ok) throw new Error('Erro ao revogar.');

      const payload = await res.json();
      setMember(payload.member);
      setActionMessage('Estatuto revogado com sucesso.');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm('Reativar este membro?')) return;
    setActionLoading(true);
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sessao invalida.');

      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'restore_status' }),
      });
      if (!res.ok) throw new Error('Erro ao restaurar.');

      const payload = await res.json();
      setMember(payload.member);
      setActionMessage('Membro reativado com sucesso.');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmName = window.prompt(`ATENÇÃO: Esta ação é irreversível.\nPara confirmar, escreva o nome do membro: "${member?.nome}"`);
    if (confirmName !== member?.nome) {
      if (confirmName) alert('Nome incorreto. Eliminação cancelada.');
      return;
    }

    setActionLoading(true);
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sessao invalida.');

      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao eliminar.');

      alert('Membro eliminado permanentemente.');
      router.push('/admin/membros');
    } catch (e: any) {
      alert(e.message);
      setActionLoading(false);
    }
  };

  if (!member && loading) return <AdminLayout title="Carregando..." isLoading={true}><div></div></AdminLayout>;

  return (
    <AdminLayout title="Perfil do Membro" isLoading={loading}>
      {/* Header / Back Button */}
      <div className="mb-6 flex justify-between items-center">
        <button onClick={() => router.back()} className="flex items-center text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar à Lista
        </button>
        <button onClick={() => setTab('settings')} className="text-gray-400 hover:text-gray-600 md:hidden">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {error ? <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div> : null}

      {member && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-garabandal-dark text-garabandal-gold rounded-full flex items-center justify-center text-2xl font-serif font-bold">
                {member.nome ? member.nome.charAt(0).toUpperCase() : <User />}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{member.nome || 'Sem nome'}</h1>
                <p className="text-gray-500 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> {member.email}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${member.is_membro ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {member.is_membro ? 'Membro Ativo' : 'Não Membro'}
              </span>
              {member.numero_socio && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-garabandal-gold/10 text-garabandal-dark border border-garabandal-gold/20">
                  Sócio #{member.numero_socio}
                </span>
              )}
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {(['resumo', 'quota', 'pagamentos', 'contactos', 'settings'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${tab === t
                  ? 'border-garabandal-gold text-garabandal-dark'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                  } capitalize`}
              >
                {t === 'settings' ? 'Admin' : t}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[400px]">

            {tab === 'resumo' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Pago (Quotas)</span>
                  <strong className="text-2xl text-gray-900 font-serif">{formatCurrency(paymentSummary.totalPaid)}</strong>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Tipo de Subscrição</span>
                  <strong className="text-lg text-gray-900 capitalize">{member.tipo_subscricao || '—'}</strong>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Antiguidade</span>
                  <strong className="text-lg text-gray-900">{getTenureLabel(member.data_adesao)}</strong>
                </div>
              </div>
            )}

            {tab === 'quota' && (
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Info Column */}
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-garabandal-gold" /> Estado Atual
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <span className="text-xs text-gray-500 block">Estado Quota</span>
                    <strong className={`capitalize ${normalizeQuotaStatus(member.estado_quota) === 'pago' ? 'text-green-600' : 'text-red-500'}`}>{member.estado_quota || '—'}</strong>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <span className="text-xs text-gray-500 block">Próxima Quota</span>
                      <strong>{formatDate(member.proxima_quota)}</strong>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                      <Send className="w-5 h-5 text-garabandal-gold" /> Ações Rápidas
                    </h3>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => runAction('mark_paid')}
                        disabled={actionLoading}
                        className="flex items-center justify-center gap-2 w-full py-2 bg-green-50 text-green-700 font-medium rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" /> Marcar Quota Paga
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => runAction('resend_receipt')}
                          disabled={actionLoading}
                          className="flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <FileText className="w-4 h-4" /> Reenviar Recibo
                        </button>
                        <button
                          onClick={() => runAction('resend_diploma')}
                          disabled={actionLoading}
                          className="flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <FileText className="w-4 h-4" /> Reenviar Diploma
                        </button>
                      </div>
                    </div>
                    {actionMessage && (
                      <p className="mt-3 text-sm text-center text-gray-600 bg-blue-50 p-2 rounded-lg border border-blue-100">{actionMessage}</p>
                    )}
                  </div>
                </div>

                {/* Edit Form */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Save className="w-5 h-5 text-gray-500" /> Editar Dados
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                        value={formState.estado_quota}
                        onChange={(event) => setFormState((prev) => ({ ...prev, estado_quota: event.target.value }))}
                        placeholder="pago, pendente..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Próxima Quota</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                          value={formState.proxima_quota}
                          onChange={(event) => setFormState((prev) => ({ ...prev, proxima_quota: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Adesão</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                          value={formState.data_adesao}
                          onChange={(event) => setFormState((prev) => ({ ...prev, data_adesao: event.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Subscrição</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                          value={formState.tipo_subscricao}
                          onChange={(event) => setFormState((prev) => ({ ...prev, tipo_subscricao: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nº Sócio</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                          value={formState.numero_socio}
                          onChange={(event) => setFormState((prev) => ({ ...prev, numero_socio: event.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Membro Ativo?</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                        value={formState.is_membro ? 'yes' : 'no'}
                        onChange={(event) => setFormState((prev) => ({ ...prev, is_membro: event.target.value === 'yes' }))}
                      >
                        <option value="yes">Sim</option>
                        <option value="no">Não</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={actionLoading}
                      className="w-full py-2 bg-garabandal-dark text-white font-medium rounded-lg hover:bg-gray-900 transition-colors shadow-lg shadow-garabandal-dark/10"
                    >
                      {actionLoading ? 'A guardar...' : 'Guardar Alterações'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'pagamentos' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">Histórico de Pagamentos</h3>
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-garabandal-gold text-white font-medium rounded-lg hover:bg-yellow-600 transition-colors shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" /> Registar Manualmente
                  </button>
                </div>

                {payments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">Sem pagamentos registados.</div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-gray-400 uppercase text-xs font-bold tracking-wider">
                      <tr>
                        <th className="pb-3 pl-2">Data</th>
                        <th className="pb-3">Método</th>
                        <th className="pb-3 text-right">Valor</th>
                        <th className="pb-3 text-right pr-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {payments.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 pl-2 font-mono text-gray-600">{formatDate(row.data_pagamento || row.created_at)}</td>
                          <td className="py-3 font-medium text-gray-900">{row.metodo_pagamento || '—'}</td>
                          <td className="py-3 text-right text-gray-900 font-bold">{formatCurrency(row.valor)}</td>
                          <td className="py-3 text-right pr-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${(row.estado || '').toLowerCase() === 'pago' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                              {row.estado || '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'contactos' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                      value={formState.nome}
                      onChange={(e) => setFormState(prev => ({ ...prev, nome: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (Apenas leitura)</label>
                    <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed">
                      {member.email}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                      value={formState.telefone}
                      onChange={(e) => setFormState(prev => ({ ...prev, telefone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIF</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                      value={formState.nif}
                      onChange={(e) => setFormState(prev => ({ ...prev, nif: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Morada</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                      value={formState.address}
                      onChange={(e) => setFormState(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                      value={formState.postal_code}
                      onChange={(e) => setFormState(prev => ({ ...prev, postal_code: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                      value={formState.country}
                      onChange={(e) => setFormState(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    onClick={handleSave}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-6 py-2 bg-garabandal-dark text-white font-medium rounded-lg hover:bg-gray-900 transition-colors shadow-lg shadow-garabandal-dark/10"
                  >
                    <Save className="w-4 h-4" />
                    {actionLoading ? 'A guardar...' : 'Guardar Alterações'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'settings' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="bg-white border rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5" /> Gestão de Acesso
                  </h3>
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-bold text-gray-800">Estatuto de Membro</h4>
                      <p className="text-sm text-gray-500">
                        {member.is_membro
                          ? 'O utilizador tem acesso ativo como membro.'
                          : 'O utilizador está suspenso/sem acesso de membro.'}
                      </p>
                    </div>
                    <button
                      onClick={member.is_membro ? handleRevoke : handleRestore}
                      className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${member.is_membro
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                    >
                      {member.is_membro ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      {member.is_membro ? 'Revogar / Suspender' : 'Reativar Acesso'}
                    </button>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-red-900 flex items-center gap-2 mb-4">
                    <Trash2 className="w-5 h-5" /> Zona de Perigo
                  </h3>
                  <p className="text-red-700 mb-6 text-sm">
                    Ações irreversíveis. Tenha extremo cuidado.
                  </p>
                  <div className="flex items-center justify-between p-4 bg-white border border-red-200 rounded-lg">
                    <div>
                      <h4 className="font-bold text-red-800">Eliminar Registo</h4>
                      <p className="text-sm text-red-600/70">
                        Apaga permanentemente os dados pessoais e histórico.
                      </p>
                    </div>
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Eliminar Membro
                    </button>
                  </div>
                </div>
              </div>
            )}


          </div>

          {/* Manual Payment Modal */}
          {isPaymentModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="text-lg font-bold font-serif text-gray-900">Registar Pagamento</h3>
                  <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={handleRegisterPayment} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold focus:outline-none"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                      <input
                        type="date"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold focus:outline-none"
                        value={paymentForm.date}
                        onChange={e => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold focus:outline-none"
                        value={paymentForm.type}
                        onChange={e => setPaymentForm(prev => ({
                          ...prev,
                          type: e.target.value,
                          update_quota: e.target.value === 'quota' // Reset update_quota based on type
                        }))}
                      >
                        <option value="quota">Quota</option>
                        <option value="donation">Doação</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold focus:outline-none"
                      value={paymentForm.method}
                      onChange={e => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                    >
                      <option value="transfer">Transferência Bancária</option>
                      <option value="cash">Numerário</option>
                      <option value="check">Cheque</option>
                      <option value="mbway">MB Way</option>
                      <option value="multibanco">Ref. Multibanco</option>
                      <option value="stripe">Stripe (Cartão)</option>
                      <option value="paypal">PayPal</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold focus:outline-none"
                      rows={2}
                      value={paymentForm.notes}
                      onChange={e => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Ex: Entrege em mão na sede..."
                    />
                  </div>

                  {paymentForm.type === 'quota' && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <input
                        type="checkbox"
                        id="updateQuota"
                        className="w-4 h-4 text-garabandal-dark rounded border-gray-300 focus:ring-garabandal-gold"
                        checked={paymentForm.update_quota}
                        onChange={e => setPaymentForm(prev => ({ ...prev, update_quota: e.target.checked }))}
                      />
                      <label htmlFor="updateQuota" className="text-sm text-blue-800 font-medium cursor-pointer select-none">
                        Atualizar estado da quota e validade?
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-3 bg-garabandal-dark text-white font-medium rounded-xl hover:bg-gray-900 transition-colors shadow-lg shadow-garabandal-dark/10 flex justify-center items-center gap-2"
                  >
                    {actionLoading ? 'A Registar...' : 'Registar Pagamento'}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      )}
    </AdminLayout>
  );
}
