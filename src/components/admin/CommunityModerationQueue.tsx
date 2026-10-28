'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';

type Item = {
  content_type: string; content_id: string; author_id: string; body: string;
  report_count: number; last_reported_at: string; is_hidden: boolean;
  reasons: string[]; image_url: string | null; avatar_url: string | null;
  author_name: string | null; author_email: string | null;
};

const labels: Record<string, string> = {
  request: 'Pedido de oração', post: 'Publicação', comment: 'Comentário',
  person: 'Perfil', gathering: 'Rezar juntos', mass_comment: 'Comentário da missa',
};

export default function CommunityModerationQueue() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = async () => (await supabaseBrowser?.auth.getSession())?.data.session?.access_token;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sessionToken = await token();
      const response = await fetch(`/api/admin/moderation/community${showHistory ? '?history=1' : ''}`, {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}, cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar a fila.');
      setItems(result.items || []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro inesperado.');
    } finally { setLoading(false); }
  }, [showHistory]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (item: Item, action: 'hide' | 'restore' | 'dismiss' | 'escalate' | 'remove_avatar') => {
    let note = '';
    if (action === 'escalate') {
      const entered = prompt('Indica o motivo e a ação de acompanhamento:');
      if (!entered?.trim()) return;
      note = entered.trim();
    } else if (!confirm(`Confirmar decisão: ${action === 'hide' ? 'ocultar' : action === 'restore' ? 'repor' : action === 'remove_avatar' ? 'retirar fotografia do perfil' : 'arquivar'}?`)) return;
    setBusy(item.content_id);
    try {
      const sessionToken = await token();
      const response = await fetch('/api/admin/moderation/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
        body: JSON.stringify({ contentType: item.content_type, contentId: item.content_id, action, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível registar a decisão.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro inesperado.');
    } finally { setBusy(null); }
  };

  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold text-slate-900">Comunidade</h2>
        <p className="text-sm text-slate-500">Fotos, partilhas, comentários, grupos de oração e perfis denunciados.</p></div>
      <button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">Atualizar</button>
      <button onClick={() => setShowHistory(value => !value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">{showHistory ? 'Ver pendentes' : 'Incluir histórico'}</button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {loading ? <p className="text-slate-500">A carregar denúncias...</p>
      : items.length === 0 ? <p className="rounded-xl bg-white p-5 text-slate-500">Sem denúncias pendentes.</p>
      : items.map(item => <article key={`${item.content_type}:${item.content_id}`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <strong>{labels[item.content_type] || item.content_type}</strong>
          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">{item.report_count} denúncia(s){showHistory ? ' no total' : ' pendentes'}</span>
          {item.is_hidden && <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-800">Oculto</span>}
        </div>
        <p className="whitespace-pre-wrap break-words text-slate-800">{item.body || '(sem texto)'}</p>
        {item.image_url && <a href={item.image_url} target="_blank" rel="noreferrer" className="block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinado e temporário do Storage */}
          <img src={item.image_url} alt="Fotografia denunciada" className="max-h-80 rounded-xl border border-slate-200 object-contain" />
        </a>}
        {item.avatar_url && <a href={item.avatar_url} target="_blank" rel="noreferrer" className="block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil pública */}
          <img src={item.avatar_url} alt="Fotografia de perfil" className="h-32 w-32 rounded-full border border-slate-200 object-cover" />
        </a>}
        <p className="text-sm text-slate-500">Autor: {item.author_name || item.author_id} {item.author_email ? `(${item.author_email})` : ''}</p>
        <p className="text-sm text-slate-500">Motivos: {item.reasons.join(', ')} · Última denúncia: {new Date(item.last_reported_at).toLocaleString('pt-PT')}</p>
        <div className="flex flex-wrap gap-2">
          {item.content_type !== 'person' && (!showHistory || item.is_hidden) && <button disabled={busy === item.content_id} onClick={() => void decide(item, item.is_hidden ? 'restore' : 'hide')} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{item.is_hidden ? 'Repor' : 'Ocultar'}</button>}
          {!showHistory && item.content_type === 'person' && item.avatar_url && <button disabled={busy === item.content_id} onClick={() => void decide(item, 'remove_avatar')} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">Retirar fotografia</button>}
          {!showHistory && <button disabled={busy === item.content_id} onClick={() => void decide(item, 'dismiss')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-50">Arquivar</button>}
          {!showHistory && <button disabled={busy === item.content_id} onClick={() => void decide(item, 'escalate')} className="rounded-xl border border-amber-300 px-4 py-2 text-sm text-amber-900 disabled:opacity-50">{item.content_type === 'person' ? 'Escalar perfil' : 'Ocultar e escalar'}</button>}
        </div>
      </article>)}
  </section>;
}
