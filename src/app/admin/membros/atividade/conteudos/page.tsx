"use client";

import useSWR from 'swr';
import AdminShell from '../../../AdminShell';
import { FileText, Music, Image as ImageIcon, EyeOff } from 'lucide-react';
import { activityFetcher, ActivityTabs, timeAgo } from '../_shared';

type ContentRow = {
  content_id: string;
  title: string;
  type: string;
  is_published: boolean;
  views: number;
  unique_viewers: number;
  last_viewed: string | null;
};

const TYPE_ICON: Record<string, any> = { pdf: FileText, audio: Music, gallery: ImageIcon };

export default function MemberActivityByContentPage() {
  const { data, isLoading } = useSWR<{ contents: ContentRow[] }>(
    '/api/admin/members/activity/by-content',
    activityFetcher,
    { revalidateOnFocus: false }
  );

  const contents = data?.contents || [];
  const dead = contents.filter((c) => c.is_published && c.views === 0);

  return (
    <AdminShell title="Atividade dos Membros" description="Que documentação privada é vista (e ignorada)">
      <ActivityTabs />

      {isLoading && !data ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-garabandal-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {dead.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
              <EyeOff className="text-amber-500 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-bold text-amber-900">{dead.length} {dead.length === 1 ? 'conteúdo publicado nunca foi aberto' : 'conteúdos publicados nunca foram abertos'}</p>
                <p className="text-sm text-amber-700">{dead.map((c) => c.title).slice(0, 5).join(' · ')}{dead.length > 5 ? '…' : ''}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="text-left font-bold px-5 py-3">Conteúdo</th>
                    <th className="text-left font-bold px-5 py-3">Tipo</th>
                    <th className="text-right font-bold px-5 py-3">Aberturas</th>
                    <th className="text-right font-bold px-5 py-3">Membros únicos</th>
                    <th className="text-left font-bold px-5 py-3">Última abertura</th>
                    <th className="text-left font-bold px-5 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {contents.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 italic">Sem conteúdo.</td></tr>
                  ) : (
                    contents.map((c) => {
                      const Icon = TYPE_ICON[c.type] || FileText;
                      const isDead = c.is_published && c.views === 0;
                      return (
                        <tr key={c.content_id} className={`border-t border-slate-50 ${isDead ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-5 py-3 font-bold text-slate-900">{c.title}</td>
                          <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 text-slate-500"><Icon size={14} /> {c.type}</span></td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900">{c.views}</td>
                          <td className="px-5 py-3 text-right text-slate-600">{c.unique_viewers}</td>
                          <td className="px-5 py-3 text-slate-600">{timeAgo(c.last_viewed)}</td>
                          <td className="px-5 py-3">
                            {c.is_published
                              ? <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Publicado</span>
                              : <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Rascunho</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
