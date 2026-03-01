"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Users, UserPlus, Link2, AlertTriangle, Search } from 'lucide-react';

type ReferralStats = {
  total_members: number;
  members_with_referral_code: number;
  invited_members_total: number;
  invited_members_paid: number;
  invited_members_pending: number;
  invited_members_with_known_inviter: number;
  invited_members_without_known_inviter: number;
  inviters_with_at_least_one_invite: number;
};

type TopInviter = {
  inviter_id: string;
  inviter_name: string | null;
  inviter_email: string | null;
  inviter_member_number: string | null;
  referral_code: string | null;
  registered_referrals_count: number;
  store_credits: number;
  actual_invites: number;
  paid_invites: number;
  pending_invites: number;
  count_gap: number;
};

type InvitedMember = {
  id?: string;
  invitee_id: string;
  invitee_name: string | null;
  invitee_email: string | null;
  invitee_member_number: string | null;
  invitee_country: string | null;
  invitee_joined_at: string | null;
  invitee_quota_status: string | null;
  used_code: string;
  paid: boolean;
  inviter_id: string | null;
  inviter_name: string | null;
  inviter_email: string | null;
  inviter_member_number: string | null;
};

type ReferralsResponse = {
  stats: ReferralStats;
  topInviters: TopInviter[];
  invitedMembers: InvitedMember[];
};
type ApiError = { error?: string };

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('pt-PT') : '—');

export default function AdminConvitesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats>({
    total_members: 0,
    members_with_referral_code: 0,
    invited_members_total: 0,
    invited_members_paid: 0,
    invited_members_pending: 0,
    invited_members_with_known_inviter: 0,
    invited_members_without_known_inviter: 0,
    inviters_with_at_least_one_invite: 0,
  });
  const [topInviters, setTopInviters] = useState<TopInviter[]>([]);
  const [invitedMembers, setInvitedMembers] = useState<InvitedMember[]>([]);
  const [query, setQuery] = useState('');
  const [inviteFilter, setInviteFilter] = useState<'all' | 'paid' | 'pending' | 'unknown'>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Sessão inválida.');

        const res = await fetch('/api/admin/referrals', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as ReferralsResponse | ApiError;
        if (!res.ok) throw new Error(('error' in json && json.error) || 'Erro ao carregar convites.');

        const payload = json as ReferralsResponse;
        setStats(payload.stats);
        setTopInviters(payload.topInviters || []);
        setInvitedMembers(payload.invitedMembers || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar dados de convites.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredInvites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invitedMembers.filter((row) => {
      const filterMatch =
        inviteFilter === 'all' ||
        (inviteFilter === 'paid' && row.paid) ||
        (inviteFilter === 'pending' && !row.paid) ||
        (inviteFilter === 'unknown' && !row.inviter_id);

      if (!filterMatch) return false;
      if (!q) return true;

      return (
        (row.invitee_name || '').toLowerCase().includes(q) ||
        (row.invitee_email || '').toLowerCase().includes(q) ||
        (row.inviter_name || '').toLowerCase().includes(q) ||
        (row.inviter_email || '').toLowerCase().includes(q) ||
        (row.used_code || '').toLowerCase().includes(q)
      );
    });
  }, [invitedMembers, inviteFilter, query]);

  const topInvitersColumns = [
    {
      key: 'inviter_name',
      header: 'Membro',
      render: (item: TopInviter) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900">{item.inviter_name || '—'}</span>
          <span className="text-xs text-gray-500">{item.inviter_email || 'Sem email'}</span>
        </div>
      ),
    },
    {
      key: 'referral_code',
      header: 'Código',
      align: 'center' as const,
      render: (item: TopInviter) => (
        <span className="font-mono text-xs px-2 py-1 bg-gray-100 rounded">{item.referral_code || '—'}</span>
      ),
    },
    { key: 'actual_invites', header: 'Convites Reais', align: 'center' as const, sortable: true },
    { key: 'paid_invites', header: 'Pagos', align: 'center' as const, sortable: true },
    { key: 'pending_invites', header: 'Pendentes', align: 'center' as const, sortable: true },
    {
      key: 'registered_referrals_count',
      header: 'Contador',
      align: 'center' as const,
      sortable: true,
      render: (item: TopInviter) => (
        <span className={item.count_gap === 0 ? 'text-gray-700' : 'text-amber-700 font-bold'}>
          {item.registered_referrals_count}
        </span>
      ),
    },
    {
      key: 'store_credits',
      header: 'Saldo Loja',
      align: 'right' as const,
      sortable: true,
      render: (item: TopInviter) => `€ ${Number(item.store_credits || 0).toFixed(2)}`,
    },
  ];

  const inviteColumns = [
    {
      key: 'invitee_name',
      header: 'Novo Membro',
      render: (item: InvitedMember) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900">{item.invitee_name || '—'}</span>
          <span className="text-xs text-gray-500">{item.invitee_email || 'Sem email'}</span>
        </div>
      ),
    },
    {
      key: 'inviter_name',
      header: 'Convidou',
      render: (item: InvitedMember) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800">{item.inviter_name || 'Código sem dono'}</span>
          <span className="text-xs text-gray-500">{item.inviter_email || item.used_code}</span>
        </div>
      ),
    },
    {
      key: 'paid',
      header: 'Estado',
      align: 'center' as const,
      render: (item: InvitedMember) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            item.paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {item.paid ? 'Pago' : 'Pendente'}
        </span>
      ),
    },
    {
      key: 'used_code',
      header: 'Código usado',
      align: 'center' as const,
      render: (item: InvitedMember) => (
        <span className="font-mono text-xs px-2 py-1 bg-gray-100 rounded">{item.used_code}</span>
      ),
    },
    {
      key: 'invitee_joined_at',
      header: 'Adesão',
      align: 'right' as const,
      sortable: true,
      render: (item: InvitedMember) => formatDate(item.invitee_joined_at),
    },
  ];

  return (
    <AdminLayout title="Convites de Membros">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <AdminStatCard title="Membros com Código" value={stats.members_with_referral_code} icon={Link2} color="blue" />
        <AdminStatCard title="Entraram por Convite" value={stats.invited_members_total} icon={UserPlus} color="green" />
        <AdminStatCard title="Convites Pagos" value={stats.invited_members_paid} icon={Users} color="gold" />
        <AdminStatCard title="Códigos sem Dono" value={stats.invited_members_without_known_inviter} icon={AlertTriangle} color="purple" />
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Search className="w-4 h-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por nome, email ou código..."
            className="w-full md:w-80 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all' as const, label: 'Todos' },
            { key: 'paid' as const, label: 'Pagos' },
            { key: 'pending' as const, label: 'Pendentes' },
            { key: 'unknown' as const, label: 'Sem dono' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setInviteFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                inviteFilter === opt.key ? 'bg-garabandal-dark text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Top membros que mais convidaram</h2>
          <AdminTable
            data={topInviters.map((item) => ({ ...item, id: item.inviter_id }))}
            columns={topInvitersColumns}
            isLoading={loading}
            searchPlaceholder="Pesquisar no ranking..."
            itemsPerPage={8}
          />
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Entradas por convite</h2>
          <AdminTable
            data={filteredInvites.map((item) => ({ ...item, id: item.invitee_id }))}
            columns={inviteColumns}
            isLoading={loading}
            searchPlaceholder="Pesquisar entradas..."
            itemsPerPage={12}
          />
        </section>
      </div>
    </AdminLayout>
  );
}
