"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  Users,
  UserCheck,
  UserX,
  Crown,
  Clock,
  Search,
  Filter,
  ArrowRight
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
  const estado = (member.estado_quota || '').toLowerCase();
  if (!member.is_membro) return 'Nao membro';
  if (estado === 'pago' || estado === 'paid') return 'Ativo';
  if (estado.includes('atras')) return 'Em atraso';
  if (estado === 'pendente') return 'Pendente';
  return estado ? estado : 'Indefinido';
};

export default function AdminMembrosPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    active: 0,
    pending: 0,
    overdue: 0,
    founders: 0,
    dueSoon: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state managed locally for now, could be server-side if needed
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMembers = async () => {
    // ... (keep existing fetch logic)
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const statusMatch = statusFilter === 'all' ||
        (statusFilter === 'active' && (member.estado_quota === 'pago' || member.estado_quota === 'paid')) ||
        (statusFilter === 'overdue' && member.estado_quota?.includes('atras')) ||
        (statusFilter === 'pending' && member.estado_quota === 'pendente') ||
        (statusFilter === 'inactive' && !member.is_membro);

      const typeMatch = typeFilter === 'all' || member.tipo_subscricao?.toLowerCase().includes(typeFilter);

      const searchLower = searchTerm.toLowerCase();
      const searchMatch = !searchTerm ||
        (member.nome?.toLowerCase().includes(searchLower)) ||
        (member.email?.toLowerCase().includes(searchLower)) ||
        (member.numero_socio?.toString().includes(searchLower));

      return statusMatch && typeMatch && searchMatch;
    });
  }, [members, statusFilter, typeFilter, searchTerm]);

  const columns = [
    {
      key: 'nome', header: 'Membro', render: (item: MemberRow) => (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${item.is_membro ? 'bg-garabandal-dark text-garabandal-gold' : 'bg-gray-200 text-gray-500'}`}>
            {item.nome?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex flex-col">
            <span className={`font-bold ${item.is_membro ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{item.nome || '—'}</span>
            <span className="text-xs text-gray-500">{item.email}</span>
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
    <AdminLayout title="Gestão de Membros" isLoading={loading}>
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
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">

          {/* Status Filters */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
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

          {/* Search Bar */}
          <div className="relative w-full md:w-72">
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
    </AdminLayout>
  );
}
