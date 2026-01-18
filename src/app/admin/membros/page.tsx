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

  const fetchMembers = async () => {
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
        (statusFilter === 'pending' && member.estado_quota === 'pendente');

      const typeMatch = typeFilter === 'all' || member.tipo_subscricao?.toLowerCase().includes(typeFilter);

      return statusMatch && typeMatch;
    });
  }, [members, statusFilter, typeFilter]);

  const columns = [
    {
      key: 'nome', header: 'Nome', render: (item: MemberRow) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{item.nome || '—'}</span>
          <span className="text-xs text-gray-500">{item.tipo_subscricao || 'Regular'}</span>
        </div>
      )
    },
    { key: 'email', header: 'Email', render: (item: MemberRow) => <span className="text-gray-600">{item.email}</span> },
    { key: 'numero_socio', header: 'Nº Sócio', align: 'center' as const, render: (item: MemberRow) => <span className="font-mono font-bold text-gray-900">#{item.numero_socio ?? '—'}</span> },
    {
      key: 'estado_quota', header: 'Estado', align: 'center' as const, render: (item: MemberRow) => {
        const label = getStatusLabel(item);
        const styles = {
          'Ativo': 'bg-green-100 text-green-700 border-green-200',
          'Em atraso': 'bg-red-100 text-red-700 border-red-200',
          'Pendente': 'bg-yellow-100 text-yellow-700 border-yellow-200',
          'Nao membro': 'bg-gray-100 text-gray-600 border-gray-200',
          'Indefinido': 'bg-gray-100 text-gray-600 border-gray-200'
        };
        const style = (styles as any)[label] || styles['Indefinido'];
        return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>{label}</span>
      }
    },
    { key: 'proxima_quota', header: 'Próxima Quota', align: 'right' as const, render: (item: MemberRow) => <span className="font-medium text-gray-700">{formatDate(item.proxima_quota)}</span> },
    { key: 'country', header: 'País', align: 'center' as const, render: (item: MemberRow) => <span className="text-sm">{item.country || '—'}</span> },
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
          color="gold" // Warning color used as Gold here for "Garabandal style", but Red context
        />
        <AdminStatCard
          title="Fundadores"
          value={summary.founders}
          icon={Crown}
          color="purple"
        />
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${statusFilter === 'all' ? 'bg-garabandal-dark text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
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
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${statusFilter === 'pending' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
            >
              Pendentes
            </button>
          </div>
        </div>

        <AdminTable
          data={filteredMembers}
          columns={columns}
          itemsPerPage={15}
          actions={(item) => (
            <Link
              href={`/admin/membros/${item.id}`}
              className="flex items-center justify-end gap-1 text-sm font-medium text-garabandal-gold hover:text-garabandal-dark transition-colors"
            >
              Ver Perfil <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        />
      </div>
    </AdminLayout>
  );
}
