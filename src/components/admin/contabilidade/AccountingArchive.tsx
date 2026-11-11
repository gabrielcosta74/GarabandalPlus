'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Download, FileText, Folder, LoaderCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react';

import { getBrowserAccessToken } from '../../../lib/supabase-browser';

const ROOT = 'contabilidade-apostolado';
type Item = { name: string; path: string; kind: 'file' | 'folder'; size: number | null };
type Breadcrumb = { name: string; path: string };
type Listing = { path: string; breadcrumbs: Breadcrumb[]; items: Item[]; hasMore: boolean; nextOffset: number };

async function adminJson(url: string): Promise<Listing> {
  const token = await getBrowserAccessToken();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Não foi possível abrir o arquivo.');
  return body as Listing;
}

const sizeLabel = (bytes: number | null) => {
  if (bytes === null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} MB`;
};

export default function AccountingArchive({ onBack }: { onBack: () => void }) {
  const [folder, setFolder] = useState(ROOT);
  const folderRef = useRef(ROOT);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ name: ROOT, path: ROOT }]);
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    folderRef.current = folder;
    setItems([]);
    setHasMore(false);
    setNextOffset(0);
    setSearch('');
    setLoading(true);
    setError(null);
    void adminJson(`/api/admin/contabilidade/arquivo?path=${encodeURIComponent(folder)}`)
      .then((result: Listing) => {
        if (active) { setItems(result.items); setBreadcrumbs(result.breadcrumbs); setHasMore(result.hasMore); setNextOffset(result.nextOffset); }
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a pasta.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [folder, refreshKey]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const result = await adminJson(`/api/admin/contabilidade/arquivo?path=${encodeURIComponent(folder)}&offset=${nextOffset}`);
      if (result.path === folderRef.current) {
        setItems(current => [...current, ...result.items]);
        setHasMore(result.hasMore);
        setNextOffset(result.nextOffset);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar mais documentos.');
    } finally {
      setLoadingMore(false);
    }
  }, [folder, nextOffset]);

  const download = useCallback(async (item: Item) => {
    setDownloading(item.path);
    setError(null);
    try {
      const token = await getBrowserAccessToken();
      const response = await fetch(`/api/admin/contabilidade/arquivo/download?path=${encodeURIComponent(item.path)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível descarregar o documento.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível descarregar o documento.');
    } finally {
      setDownloading(null);
    }
  }, []);

  const visible = useMemo(() => items.filter(item =>
    item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()),
  ), [items, search]);
  const parent = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].path : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" /> Voltar aos documentos
          </button>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900">contabilidade-apostolado</h1>
          <p className="mt-1 text-sm text-zinc-500">Arquivo privado com as pastas originais da contabilidade.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <ShieldCheck className="h-4 w-4" /> Acesso privado
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm" aria-label="Caminho da pasta">
            {breadcrumbs.map((crumb, index) => {
              return <span key={crumb.path} className="inline-flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-4 w-4 text-zinc-300" aria-hidden />}
                <button type="button" onClick={() => setFolder(crumb.path)} className={index === breadcrumbs.length - 1 ? 'font-semibold text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}>
                  {crumb.name}
                </button>
              </span>;
            })}
          </nav>
          <button type="button" onClick={() => setRefreshKey(value => value + 1)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Atualizar documentos">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <span className="sr-only">Pesquisar nesta pasta</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar nesta pasta"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-400 focus:bg-white" />
        </label>

        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {loading ? <div className="flex items-center gap-2 py-10 text-sm text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" /> A carregar documentos…</div> : (
          <div className="mt-4 divide-y divide-zinc-100">
            {parent && <button type="button" onClick={() => setFolder(parent)} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm text-zinc-500 hover:bg-zinc-50">
              <ArrowLeft className="h-4 w-4" /> Voltar à pasta anterior
            </button>}
            {visible.map(item => item.kind === 'folder' ? (
              <button key={item.path} type="button" onClick={() => setFolder(item.path)} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-zinc-50">
                <Folder className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                <span className="min-w-0 flex-1 break-words text-sm font-medium text-zinc-900">{item.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              </button>
            ) : (
              <div key={item.path} className="flex items-center gap-3 px-2 py-3">
                <FileText className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
                <span className="min-w-0 flex-1 break-words text-sm text-zinc-800">{item.name}</span>
                <span className="hidden shrink-0 text-xs text-zinc-400 sm:inline">{sizeLabel(item.size)}</span>
                <button type="button" onClick={() => void download(item)} disabled={!!downloading}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                  aria-label={`Descarregar ${item.name}`}>
                  {downloading === item.path ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Descarregar
                </button>
              </div>
            ))}
            {visible.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">{search ? 'Nenhum resultado nesta pasta.' : 'Esta pasta está vazia.'}</p>}
          </div>
        )}
        {hasMore && <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="mt-4 w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
          {loadingMore ? 'A carregar…' : 'Mostrar mais documentos'}
        </button>}
      </div>
    </div>
  );
}
