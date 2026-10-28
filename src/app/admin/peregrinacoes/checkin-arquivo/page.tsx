'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AdminShell from '../../AdminShell';
import PilgrimageCheckinData from '../../../../components/admin/PilgrimageCheckinData';
import { getBrowserAccessToken } from '../../../../lib/supabase-browser';

type Archive = { id: string; title: string; notes: string; pilgrimageId: string; count: number };

export default function CheckinArchivePage() {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const token = await getBrowserAccessToken();
        const response = await fetch('/api/admin/checkin-archives', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Erro ao carregar o arquivo.');
        if (active) {
          setArchives(body.archives);
          setSelectedId(new URLSearchParams(window.location.search).get('arquivo') || body.archives[0]?.id || '');
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar o arquivo.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const selected = archives.find(archive => archive.id === selectedId);
  return (
    <AdminShell title="Arquivo de check-in" description="Dados preservados de peregrinações anteriores, incluindo inscrições realizadas fora da plataforma.">
      <div className="space-y-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {loading ? <div role="status" className="flex items-center gap-2 p-6 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />A carregar arquivo...</div> : <>
          <label className="block text-sm font-bold text-slate-700">Peregrinação arquivada
            <select value={selectedId} onChange={event => {
              setSelectedId(event.target.value);
              window.history.replaceState({}, '', `?arquivo=${encodeURIComponent(event.target.value)}`);
            }} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900">
              {archives.map(archive => <option key={archive.id} value={archive.id}>{archive.title} — {archive.count} respostas</option>)}
            </select>
          </label>
          {selected ? <PilgrimageCheckinData key={selected.id} pilgrimageId={selected.pilgrimageId} archiveId={selected.id} />
            : <p className="p-4 text-sm text-slate-500">Arquivo não encontrado.</p>}
        </>}
      </div>
    </AdminShell>
  );
}
