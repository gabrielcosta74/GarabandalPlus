"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { isPaidStatus, normalizeQuotaStatus } from '../../../lib/membership-status';
import {
  Users,
  UserCheck,
  UserX,
  Crown,
  Search,
  ArrowRight,
  PlusCircle,
  XCircle,
  CheckCircle,
  Copy,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';

type MemberRow = {
  id: string;
  nome: string | null;
  email: string | null;
  country: string | null;
  numero_socio: number | null;
  estado_quota: string | null;
  proxima_quota: string | null;
  tipo_subscricao: string | null;
  is_membro: boolean | null;
  data_adesao: string | null;
};

type Summary = {
  total: number;
  active: number;
  pending: number;
  overdue: number;
  founders: number;
  dueSoon: number;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('pt-PT') : '—';

const getStatusLabel = (member: MemberRow) => {
  const estado = normalizeQuotaStatus(member.estado_quota);
  if (!member.is_membro) return 'Nao membro';
  if (estado === 'pago') return 'Ativo';
  if (estado === 'expirado') return 'Em atraso';
  if (estado === 'pendente') return 'Pendente';
  return estado ? estado : 'Indefinido';
};

export default function AdminMembrosPage() {
  const isInternalMemberEmail = (email?: string | null) => !!email && email.endsWith('@sem-email.local');
  const displayMemberEmail = (email?: string | null) => {
    if (!email || isInternalMemberEmail(email)) return 'Sem email';
    return email;
  };

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    active: 0,
    pending: 0,
    overdue: 0,
    founders: 0,
    dueSoon: 0,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state managed locally for now, could be server-side if needed
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'numero_asc' | 'numero_desc' | 'nome_asc' | 'nome_desc' | 'status' | 'proxima_quota' | 'adesao_desc'>('numero_asc');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMembers = async (isBackground = false) => {
    if (!isBackground) setInitialLoading(members.length === 0);
    setIsRefreshing(true);
    setError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      // We fetch all members and filter client side for better UX on small datasets (< 1000)
      const res = await fetch(`/api/admin/members?status=all&type=all&country=all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Falha ao carregar membros.');
      const data = await res.json();
      setMembers(data.members || []);
      setSummary(data.summary || summary);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar membros.');
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [successData, setSuccessData] = useState<{ hasAccount: boolean; email?: string | null; password?: string; warning?: string | null } | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    nome: '',
    email: '',
    create_account: true,
    telefone: '',
    nif: '',
    address: '',
    postal_code: '',
    city: '',
    country: 'Portugal',
    initial_payment: true,
    payment_method: 'transfer'
  });

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase indisponível');
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) throw new Error('Sessão inválida');

      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'create_member',
          ...createForm
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar membro');
      }

      // Success!
      setSuccessData({
        hasAccount: !!data.hasAccount,
        email: data.memberEmail || (createForm.create_account ? createForm.email : null),
        password: data.temporaryPassword,
        warning: data.warning || null,
      });
      setIsCreateModalOpen(false);

      // Reset Form
      setCreateForm({
        nome: '',
        email: '',
        create_account: true,
        telefone: '',
        nif: '',
        address: '',
        postal_code: '',
        city: '',
        country: 'Portugal',
        initial_payment: true,
        payment_method: 'transfer'
      });

      fetchMembers(true); // Background refresh

    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const countryOptions = useMemo(() => {
    const unique = new Set<string>();
    members.forEach((member) => {
      const country = (member.country || '').trim();
      if (country) unique.add(country);
    });
    return ['all', ...Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-PT'))];
  }, [members]);

  const filteredMembers = useMemo(() => {
    const filtered = members.filter(member => {
      const normalized = normalizeQuotaStatus(member.estado_quota);
      const statusMatch = statusFilter === 'all' ||
        (statusFilter === 'active' && isPaidStatus(member.estado_quota)) ||
        (statusFilter === 'overdue' && normalized === 'expirado') ||
        (statusFilter === 'pending' && normalized === 'pendente') ||
        (statusFilter === 'inactive' && !member.is_membro);

      const typeMatch = typeFilter === 'all' || member.tipo_subscricao?.toLowerCase().includes(typeFilter);
      const countryMatch = countryFilter === 'all' || (member.country || '').trim() === countryFilter;
      const hasAccount = !isInternalMemberEmail(member.email) && !!member.email;
      const accountMatch = accountFilter === 'all' ||
        (accountFilter === 'with_account' && hasAccount) ||
        (accountFilter === 'without_account' && !hasAccount);

      const searchLower = searchTerm.toLowerCase();
      const searchMatch = !searchTerm ||
        (member.nome?.toLowerCase().includes(searchLower)) ||
        (member.email?.toLowerCase().includes(searchLower)) ||
        (member.numero_socio?.toString().includes(searchLower));

      return statusMatch && typeMatch && countryMatch && accountMatch && searchMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      const parseDate = (value?: string | null) => {
        if (!value) return 0;
        const t = new Date(value).getTime();
        return Number.isFinite(t) ? t : 0;
      };
      const statusOrder = (member: MemberRow) => {
        const label = getStatusLabel(member);
        if (label === 'Ativo') return 1;
        if (label === 'Pendente') return 2;
        if (label === 'Em atraso') return 3;
        if (label === 'Nao membro') return 4;
        return 5;
      };
      const aNumber = Number(a.numero_socio ?? Number.MAX_SAFE_INTEGER);
      const bNumber = Number(b.numero_socio ?? Number.MAX_SAFE_INTEGER);
      const aName = (a.nome || '').toLowerCase();
      const bName = (b.nome || '').toLowerCase();

      if (sortBy === 'numero_asc') return aNumber - bNumber;
      if (sortBy === 'numero_desc') return bNumber - aNumber;
      if (sortBy === 'nome_asc') return aName.localeCompare(bName, 'pt-PT');
      if (sortBy === 'nome_desc') return bName.localeCompare(aName, 'pt-PT');
      if (sortBy === 'status') return statusOrder(a) - statusOrder(b);
      if (sortBy === 'proxima_quota') return parseDate(a.proxima_quota) - parseDate(b.proxima_quota);
      return parseDate(b.data_adesao) - parseDate(a.data_adesao);
    });

    return sorted;
  }, [members, statusFilter, typeFilter, countryFilter, accountFilter, searchTerm, sortBy]);

  const columns = [
    {
      key: 'nome', header: 'Membro', render: (item: MemberRow) => (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${item.is_membro ? 'bg-garabandal-dark text-garabandal-gold' : 'bg-gray-200 text-gray-500'}`}>
            {item.nome?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex flex-col">
            <span className={`font-bold ${item.is_membro ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{item.nome || '—'}</span>
            <span className="text-xs text-gray-500">{displayMemberEmail(item.email)}</span>
          </div>
        </div>
      )
    },
    { key: 'numero_socio', header: 'Nº Sócio', align: 'center' as const, render: (item: MemberRow) => <span className="font-mono font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded">#{item.numero_socio ?? '—'}</span> },
    {
      key: 'estado_quota', header: 'Quota', align: 'center' as const, render: (item: MemberRow) => {
        const label = getStatusLabel(item);
        const styles = {
          'Ativo': 'bg-green-100 text-green-700 border-green-200',
          'Em atraso': 'bg-red-100 text-red-700 border-red-200',
          'Pendente': 'bg-yellow-100 text-yellow-700 border-yellow-200',
          'Nao membro': 'bg-gray-100 text-gray-400 border-gray-200',
          'Indefinido': 'bg-gray-100 text-gray-600 border-gray-200'
        };
        const style = (styles as any)[label] || styles['Indefinido'];
        return <span className={`px-3 py-1 rounded-full text-xs font-bold border ${style}`}>{label.toUpperCase()}</span>
      }
    },
    { key: 'proxima_quota', header: 'Validade', align: 'right' as const, render: (item: MemberRow) => <span className="text-sm font-medium text-gray-600">{formatDate(item.proxima_quota)}</span> },
  ];

  return (
    <AdminLayout title="Gestão de Membros" isLoading={initialLoading}>
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <AdminStatCard
          title="Total Membros"
          value={summary.total}
          icon={Users}
          color="blue"
        />
        <AdminStatCard
          title="Ativos"
          value={summary.active}
          icon={UserCheck}
          color="green"
        />
        <AdminStatCard
          title="Em Atraso"
          value={summary.overdue}
          icon={UserX}
          color="gold"
        />
        <AdminStatCard
          title="Fundadores"
          value={summary.founders}
          icon={Crown}
          color="purple"
        />
      </div>

      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">

          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-gray-900 transition-all shadow-md whitespace-nowrap"
            >
              <PlusCircle className="w-5 h-5" /> Novo Membro
            </button>
            <Link
              href="/admin/membros/documentacao"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all border border-slate-200 shadow-sm whitespace-nowrap"
            >
              Doc. Privada
            </Link>

            {/* Status Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${statusFilter === 'all' ? 'bg-garabandal-dark text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${statusFilter === 'active' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                Ativos
              </button>
              <button
                onClick={() => setStatusFilter('overdue')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${statusFilter === 'overdue' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                Em Atraso
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${statusFilter === 'inactive' ? 'bg-gray-200 text-gray-700 border border-gray-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                Cancelados
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 w-full">
            {/* Search Bar */}
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-garabandal-gold/50 focus:border-garabandal-gold sm:text-sm transition-all"
                placeholder="Nome, Email ou Sócio #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/50 focus:border-garabandal-gold"
            >
              <option value="all">Todos os tipos</option>
              <option value="regular">Regulares</option>
              <option value="fundador">Fundadores</option>
              <option value="honorifico">Honoríficos</option>
            </select>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/50 focus:border-garabandal-gold"
            >
              {countryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'Todos os países' : option}
                </option>
              ))}
            </select>

            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/50 focus:border-garabandal-gold"
            >
              <option value="all">Com e sem conta</option>
              <option value="with_account">Só com conta</option>
              <option value="without_account">Só sem conta</option>
            </select>

            <div className="flex gap-2">
              <div className="relative w-full">
                <ArrowUpDown className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/50 focus:border-garabandal-gold"
                >
                  <option value="numero_asc">Nº sócio (crescente)</option>
                  <option value="numero_desc">Nº sócio (decrescente)</option>
                  <option value="nome_asc">Nome (A-Z)</option>
                  <option value="nome_desc">Nome (Z-A)</option>
                  <option value="status">Estado</option>
                  <option value="proxima_quota">Validade da quota</option>
                  <option value="adesao_desc">Adesão (mais recente)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setCountryFilter('all');
                  setAccountFilter('all');
                  setSortBy('numero_asc');
                  setSearchTerm('');
                }}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                title="Limpar filtros"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <AdminTable
          data={filteredMembers}
          columns={columns}
          itemsPerPage={15}
          actions={(item) => (
            <Link
              href={`/admin/membros/${item.id}`}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-garabandal-gold hover:text-white hover:border-garabandal-gold transition-all shadow-sm"
            >
              Gerir <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        />
      </div>

      {/* Create Member Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold font-serif text-gray-900">Novo Membro</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateMember} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                  value={createForm.nome}
                  onChange={e => setCreateForm({ ...createForm, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Registo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, create_account: true })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${createForm.create_account ? 'border-garabandal-gold bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Com Conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, create_account: false, email: '' })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${!createForm.create_account ? 'border-garabandal-gold bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Sem Conta
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  required={createForm.create_account}
                  type="email"
                  disabled={!createForm.create_account}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder={createForm.create_account ? 'membro@email.com' : 'Não necessário para registo sem conta'}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                    value={createForm.telefone}
                    onChange={e => setCreateForm({ ...createForm, telefone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                    value={createForm.city}
                    onChange={e => setCreateForm({ ...createForm, city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIF / CPF</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                    value={createForm.nif}
                    onChange={e => setCreateForm({ ...createForm, nif: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Morada</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                  value={createForm.address}
                  onChange={e => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="Rua, Nº, Andar..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal / CEP</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                    value={createForm.postal_code}
                    onChange={e => setCreateForm({ ...createForm, postal_code: e.target.value })}
                    placeholder="0000-000 / 00000-000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                    value={createForm.country}
                    onChange={e => setCreateForm({ ...createForm, country: e.target.value })}
                  />
                </div>
              </div>


              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                <input
                  type="checkbox"
                  id="initialPayment"
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  checked={createForm.initial_payment}
                  onChange={e => setCreateForm({ ...createForm, initial_payment: e.target.checked })}
                />
                <label htmlFor="initialPayment" className="text-sm font-medium text-green-800 cursor-pointer select-none">
                  Quota (25€) Paga?
                </label>
              </div>

              {createForm.initial_payment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                    value={createForm.payment_method}
                    onChange={e => setCreateForm({ ...createForm, payment_method: e.target.value })}
                  >
                    <option value="transfer">Transferência</option>
                    <option value="cash">Numerário</option>
                    <option value="check">Cheque</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
              )}
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800">
                {createForm.create_account
                  ? 'Com conta: será criada senha temporária e o email ficará confirmado.'
                  : 'Sem conta: o membro será gerido internamente pelo admin e poderá ter conta criada mais tarde.'}
              </div>
              <button
                type="submit"
                disabled={createLoading}
                className="w-full py-3 bg-garabandal-dark text-white font-medium rounded-xl hover:bg-gray-900 transition-colors shadow-lg shadow-garabandal-dark/10 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    A criar...
                  </>
                ) : 'Criar Membro'}
              </button>
            </form>
          </div>
        </div>
      )
      }

      {/* Success Modal */}
      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden text-center p-8">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold font-serif text-gray-900 mb-2">Membro Criado!</h3>
            <p className="text-gray-500 mb-6">
              O membro foi registado com sucesso.
            </p>

            <div className="bg-gray-50 p-4 rounded-xl text-left mb-6 border border-gray-100">
              {successData.hasAccount ? (
                <div className="mb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Email de Login</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-gray-900 font-medium">{successData.email}</span>
                  </div>
                </div>
              ) : (
                <div className="mb-3 text-sm text-gray-700">
                  Registo criado <strong>sem conta de acesso</strong>. Podes criar conta depois no detalhe do membro.
                </div>
              )}
              {successData.password && (
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Senha Temporária</span>
                  <div className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-lg gap-2">
                    <span className="font-mono text-lg text-garabandal-dark font-bold tracking-wide select-all flex-1">{successData.password}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(successData.password || '');
                        alert('Senha copiada!');
                      }}
                      className="p-2 text-gray-500 hover:text-garabandal-gold hover:bg-garabandal-gold/10 rounded-lg transition-colors"
                      title="Copiar Senha"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Copie esta senha agora. Por segurança, não será mostrada novamente.
                  </p>
                </div>
              )}
              {successData.warning && (
                <p className="text-xs text-amber-600 mt-3">{successData.warning}</p>
              )}
            </div>

            <button
              onClick={() => setSuccessData(null)}
              className="w-full py-3 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-gray-900 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

    </AdminLayout >
  );
}
