'use client';

import { useEffect, useState } from 'react';
import { Languages, Play, RefreshCw, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';
import AdminShell from '../AdminShell';
import { toast } from 'sonner';

interface TableProgress {
  total: number;
  translated: number;
}

const TABLE_LABELS: Record<string, string> = {
  pilgrimages: 'Peregrinações',
  store_products: 'Produtos da Loja',
  store_categories: 'Categorias da Loja',
  testimonials: 'Testemunhos',
  eventos: 'Eventos',
  member_contents: 'Conteúdos de Membros',
  member_content_categories: 'Categorias de Conteúdo',
  academy_courses: 'Cursos da Academy',
  academy_episodes: 'Episódios da Academy',
  novenas: 'Novenas',
  prayers: 'Orações',
  pilgrimage_itinerary_items: 'Itinerários de Peregrinação',
  pilgrimage_team_members: 'Equipa de Peregrinação',
};

export default function TraducoesAdminPage() {
  const [progress, setProgress] = useState<Record<string, TableProgress>>({});
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [migratingTable, setMigratingTable] = useState<string | null>(null);
  const [migratingAll, setMigratingAll] = useState(false);
  const [results, setResults] = useState<Record<string, { updated: number; skipped: number; error?: string }>>({});

  const fetchProgress = async () => {
    setLoadingProgress(true);
    try {
      const res = await fetch('/api/admin/migrate-translations');
      const data = await res.json();
      if (data.progress) setProgress(data.progress);
    } catch {
      toast.error('Erro ao carregar progresso');
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => { fetchProgress(); }, []);

  const migrateTable = async (table?: string) => {
    if (table) setMigratingTable(table);
    else setMigratingAll(true);

    try {
      const res = await fetch('/api/admin/migrate-translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(table ? { table } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro');

      setResults(prev => ({ ...prev, ...data.results }));
      toast.success(table ? `${TABLE_LABELS[table] ?? table} traduzido!` : 'Migração completa!');
      await fetchProgress();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMigratingTable(null);
      setMigratingAll(false);
    }
  };

  const totalAll = Object.values(progress).reduce((s, p) => s + p.total, 0);
  const translatedAll = Object.values(progress).reduce((s, p) => s + p.translated, 0);
  const pct = totalAll > 0 ? Math.round((translatedAll / totalAll) * 100) : 0;

  return (
    <AdminShell title="Traduções EN" description="Migração e acompanhamento das traduções automáticas do conteúdo.">
      <div className="max-w-4xl mx-auto space-y-8 pb-20">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-900 flex items-center gap-3">
              <Languages className="w-8 h-8 text-indigo-500" />
              Traduções EN
            </h1>
            <p className="text-slate-500 mt-1">Traduz automaticamente todo o conteúdo da base de dados para inglês via DeepL.</p>
          </div>
          <button
            onClick={() => migrateAll()}
            disabled={migratingAll}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {migratingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {migratingAll ? 'A traduzir...' : '🌐 Traduzir Tudo'}
          </button>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <strong>Como funciona:</strong> Para cada registo sem tradução EN, o sistema chama a API DeepL (gratuita até 500k caracteres/mês) e guarda a tradução na coluna <code className="bg-blue-100 px-1 rounded">_en</code> correspondente. Podes re-traduzir tabelas individualmente a qualquer momento.
          </div>
        </div>

        {/* Global progress */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">Progresso Global</span>
            <span className="text-sm font-mono text-slate-500">{translatedAll}/{totalAll} registos</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{pct}% traduzido</span>
            <button onClick={fetchProgress} className="flex items-center gap-1 hover:text-indigo-500 transition-colors">
              <RefreshCw className={`w-3 h-3 ${loadingProgress ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>

        {/* Per-table progress */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Por Tabela</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {Object.entries(TABLE_LABELS).map(([table, label]) => {
              const p = progress[table];
              const tablePct = p && p.total > 0 ? Math.round((p.translated / p.total) * 100) : 0;
              const isRunning = migratingTable === table;
              const result = results[table];

              return (
                <div key={table} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-700 text-sm">{label}</span>
                      <span className="text-xs text-slate-400 font-mono ml-2 shrink-0">
                        {p ? `${p.translated}/${p.total}` : '—'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${tablePct === 100 ? 'bg-emerald-500' : 'bg-indigo-400'}`}
                        style={{ width: `${tablePct}%` }}
                      />
                    </div>
                    {result && (
                      <p className="text-[11px] mt-1 text-slate-400">
                        {result.error
                          ? <span className="text-red-400">Erro: {result.error}</span>
                          : <span className="text-emerald-600">{result.updated} traduzidos, {result.skipped} ignorados</span>
                        }
                      </p>
                    )}
                  </div>

                  {tablePct === 100 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <button
                      onClick={() => migrateTable(table)}
                      disabled={!!migratingTable || migratingAll}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      {isRunning ? 'A traduzir...' : 'Traduzir'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </AdminShell>
  );

  function migrateAll() { migrateTable(undefined); }
}
