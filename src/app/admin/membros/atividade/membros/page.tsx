"use client";

import { Suspense, useState } from 'react';
import useSWR from 'swr';
import { useSearchParams, useRouter } from 'next/navigation';
import AdminShell from '../../../AdminShell';
import { X, Search } from 'lucide-react';
import { activityFetcher, ActivityTabs, featureLabel, timeAgo } from '../_shared';

type MemberRow = {
  user_id: string;
  nome: string | null;
  numero_socio: string | null;
  email: string | null;
  estado_quota: string | null;
  is_membro: boolean | null;
  last_sign_in_at: string | null;
  last_activity_at: string | null;
  events_30d: number;
  sessions_30d: number;
  top_feature: string | null;
};

type TimelineRow = { id: number; path: string; feature: string; content_id: string | null; locale: string; created_at: string };

function TimelinePanel({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const { data, isLoading } = useSWR<{ timeline: TimelineRow[] }>(
    `/api/admin/members/activity/by-member?userId=${userId}`,
    activityFetcher,
    { revalidateOnFocus: false }
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">{name}</h3>
            <p className="text-xs text-slate-400">Atividade recente (até 100 eventos)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-5">
          {isLoading ? (
            <p className="text-sm text-slate-400">A carregar...</p>
          ) : (data?.timeline || []).length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sem atividade registada.</p>
          ) : (
            <ol className="relative border-l border-slate-200 ml-2">
              {(data?.timeline || []).map((t) => (
                <li key={t.id} className="ml-4 pb-5">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-garabandal-gold border-2 border-white" />
                  <p className="text-sm font-medium text-slate-800">{featureLabel(t.feature)}</p>
                  <p className="text-xs text-slate-400">{t.path}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(t.created_at).toLocaleString('pt-PT')} · {t.locale}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function MembersInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedUserId = searchParams.get('userId');
  const [query, setQuery] = useState('');

  const { data, isLoading } = useSWR<{ members: MemberRow[] }>(
    '/api/admin/members/activity/by-member',
    activityFetcher,
    { revalidateOnFocus: false }
  );

  const members = (data?.members || []).filter((m) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (m.nome || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q) || (m.numero_socio || '').includes(q);
  });

  const selected = members.find((m) => m.user_id === selectedUserId) || (selectedUserId ? { user_id: selectedUserId, nome: 'Membro' } as Partial<MemberRow> : null);

  const openMember = (id: string) => router.push(`/admin/membros/atividade/membros?userId=${id}`);
  const closePanel = () => router.push('/admin/membros/atividade/membros');

  return (
    <AdminShell title="Atividade dos Membros" description="Detalhe de utilização por membro">
      <ActivityTabs />

      <div className="mb-4 relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar por nome, email ou nº..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-garabandal-gold/40"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="text-left font-bold px-5 py-3">Membro</th>
                <th className="text-left font-bold px-5 py-3">Última atividade</th>
                <th className="text-left font-bold px-5 py-3">Último login</th>
                <th className="text-right font-bold px-5 py-3">Eventos 30d</th>
                <th className="text-right font-bold px-5 py-3">Sessões 30d</th>
                <th className="text-left font-bold px-5 py-3">Favorito</th>
                <th className="text-left font-bold px-5 py-3">Quota</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !data ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">A carregar...</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 italic">Sem resultados.</td></tr>
              ) : (
                members.map((m) => (
                  <tr key={m.user_id} onClick={() => openMember(m.user_id)} className="border-t border-slate-50 hover:bg-slate-50/60 cursor-pointer">
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-900">{m.nome || 'Sem nome'}</p>
                      <p className="text-xs text-slate-400">{m.numero_socio ? `#${m.numero_socio} · ` : ''}{m.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{timeAgo(m.last_activity_at)}</td>
                    <td className="px-5 py-3 text-slate-600">{timeAgo(m.last_sign_in_at)}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">{m.events_30d}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{m.sessions_30d}</td>
                    <td className="px-5 py-3 text-slate-600">{featureLabel(m.top_feature)}</td>
                    <td className="px-5 py-3">
                      {m.estado_quota && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">{m.estado_quota}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected?.user_id && (
        <TimelinePanel userId={selected.user_id} name={selected.nome || 'Membro'} onClose={closePanel} />
      )}
    </AdminShell>
  );
}

export default function MemberActivityByMemberPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-400">A carregar...</div>}>
      <MembersInner />
    </Suspense>
  );
}
