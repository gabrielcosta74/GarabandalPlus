"use client";

import useSWR from 'swr';
import Link from 'next/link';
import AdminShell from '../../AdminShell';
import AdminStatCard from '../../../../components/admin/AdminStatCard';
import { Activity, Users, MousePointerClick, TrendingUp, Clock, AlertTriangle, LogIn } from 'lucide-react';
import { activityFetcher, ActivityTabs, featureLabel, timeAgo } from './_shared';

type Overview = {
  kpis: {
    total_members?: number;
    activated_members?: number;
    active_today?: number;
    active_7d?: number;
    active_30d?: number;
    login_active_7d?: number;
    login_active_30d?: number;
    sessions_today?: number;
    sessions_7d?: number;
    events_7d?: number;
  };
  daily: { day: string; sessions: number; events: number; active_users: number }[];
  features: { feature: string; events: number; unique_users: number; sessions: number }[];
  topMembers: { user_id: string; nome: string; numero_socio: string | null; events_30d: number; sessions_30d: number; top_feature: string | null; last_activity_at: string | null }[];
  dormantMembers: { user_id: string; nome: string; numero_socio: string | null; estado_quota: string | null; last_sign_in_at: string | null; last_activity_at: string | null }[];
};

export default function MemberActivityOverviewPage() {
  const { data, isLoading } = useSWR<Overview>('/api/admin/members/activity/overview?days=30', activityFetcher, {
    revalidateOnFocus: false,
  });

  const k = data?.kpis || {};
  const total = k.total_members || 0;
  const activationRate = total > 0 ? Math.round(((k.activated_members || 0) / total) * 100) : 0;
  const maxEvents = Math.max(1, ...(data?.features || []).map((f) => f.events));
  const maxDaily = Math.max(1, ...(data?.daily || []).map((d) => d.events));

  return (
    <AdminShell title="Atividade dos Membros" description="Como os membros usam a área reservada">
      <ActivityTabs />

      {isLoading && !data ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-garabandal-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI cards */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <AdminStatCard title="Ativos (7 dias)" value={k.active_7d ?? 0} icon={Activity} color="green" trendLabel="usaram a área" />
            <AdminStatCard title="Ativos (30 dias)" value={k.active_30d ?? 0} icon={Users} color="blue" trendLabel="usaram a área" />
            <AdminStatCard title="Sessões (7 dias)" value={k.sessions_7d ?? 0} icon={MousePointerClick} color="purple" trendLabel={`${k.events_7d ?? 0} aberturas`} />
            <AdminStatCard title="Taxa de ativação" value={`${activationRate}%`} icon={TrendingUp} color="gold" trendLabel={`${k.activated_members ?? 0} de ${total} membros`} />
          </section>

          {/* Login signal (works from day one, before tracking accrues) */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"><LogIn size={18} /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logins recentes</p>
                <p className="text-sm text-slate-500">Sinal de autenticação (independente do rastreio de navegação)</p>
              </div>
            </div>
            <div className="flex gap-8 ml-auto">
              <div><p className="text-2xl font-bold text-slate-900">{k.login_active_7d ?? 0}</p><p className="text-xs text-slate-400">últimos 7 dias</p></div>
              <div><p className="text-2xl font-bold text-slate-900">{k.login_active_30d ?? 0}</p><p className="text-xs text-slate-400">últimos 30 dias</p></div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Daily trend */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Atividade diária (30 dias)</h3>
              <p className="text-xs text-slate-400 mb-6">Aberturas de página por dia</p>
              <div className="flex items-end gap-1 h-48">
                {(data?.daily || []).map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center justify-end group relative" title={`${d.day}: ${d.events} aberturas, ${d.active_users} membros`}>
                    <div
                      className="w-full bg-garabandal-gold/70 group-hover:bg-garabandal-gold rounded-t transition-all"
                      style={{ height: `${(d.events / maxDaily) * 100}%`, minHeight: d.events > 0 ? '3px' : '0' }}
                    />
                  </div>
                ))}
              </div>
              {(!data?.daily || data.daily.every((d) => d.events === 0)) && (
                <p className="text-center text-sm text-slate-400 italic mt-4">Ainda sem dados de navegação. Os dados começam a acumular assim que os membros navegarem na área.</p>
              )}
            </div>

            {/* Feature usage */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Áreas mais usadas</h3>
              <p className="text-xs text-slate-400 mb-6">Aberturas por funcionalidade (30 dias)</p>
              <div className="space-y-3">
                {(data?.features || []).length === 0 && <p className="text-sm text-slate-400 italic">Sem dados ainda.</p>}
                {(data?.features || []).map((f) => (
                  <div key={f.feature}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{featureLabel(f.feature)}</span>
                      <span className="text-slate-400">{f.events} · {f.unique_users} membros</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-garabandal-gold rounded-full" style={{ width: `${(f.events / maxEvents) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Top members */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Activity size={18} className="text-emerald-500" /> Membros mais ativos</h3>
              <div className="space-y-1">
                {(data?.topMembers || []).length === 0 && <p className="text-sm text-slate-400 italic">Sem atividade registada ainda.</p>}
                {(data?.topMembers || []).map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{m.nome || 'Sem nome'}{m.numero_socio ? <span className="text-slate-400 font-normal"> · #{m.numero_socio}</span> : null}</p>
                      <p className="text-xs text-slate-400">Favorito: {featureLabel(m.top_feature)} · {timeAgo(m.last_activity_at)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-slate-900">{m.events_30d}</p>
                      <p className="text-[10px] uppercase text-slate-400">{m.sessions_30d} sessões</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dormant members */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" /> Membros inativos (30+ dias)</h3>
              <p className="text-xs text-slate-400 mb-4">Membros ativos que não usam a área — risco de não renovar quota.</p>
              <div className="space-y-1">
                {(data?.dormantMembers || []).length === 0 && <p className="text-sm text-slate-400 italic">Nenhum membro inativo. 🎉</p>}
                {(data?.dormantMembers || []).map((m) => (
                  <Link key={m.user_id} href={`/admin/membros/atividade/membros?userId=${m.user_id}`} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/60 -mx-2 px-2 rounded-lg">
                    <div className="min-w-0 flex items-center gap-2">
                      <Clock size={14} className="text-slate-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{m.nome || 'Sem nome'}{m.numero_socio ? <span className="text-slate-400 font-normal"> · #{m.numero_socio}</span> : null}</p>
                        <p className="text-xs text-slate-400">Última atividade: {timeAgo(m.last_activity_at)} · Último login: {timeAgo(m.last_sign_in_at)}</p>
                      </div>
                    </div>
                    {m.estado_quota && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 shrink-0 ml-2">{m.estado_quota}</span>}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
