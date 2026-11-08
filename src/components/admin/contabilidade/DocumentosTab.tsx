"use client";

import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Folder, FolderOpen, LoaderCircle } from 'lucide-react';

import { formatDay, formatEur, formatPeriod } from '../../../lib/ledger/format';
import { useToast } from './Toasts';
import { adminFetch, downloadAdminFile } from './useLedger';
import { Button, Card, Count, EmptyState, IconButton, cx } from './ui';

type Doc = {
  id: string;
  kind: string;
  kindLabel: string;
  fileName: string | null;
  sizeBytes: number | null;
  createdAt: string;
  movement: { id: string; date: string; period: string; who: string; description: string; amount: number; category: string };
};

/** Folders are only a way of looking: each file is stored once, tied to its payment. */
export default function DocumentosTab({ period, onOpenMovement }: { period: string | null; onOpenMovement: (movementId: string, period: string) => void }) {
  const year = (period || new Date().toISOString()).slice(0, 4);
  const [documents, setDocuments] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(period);
  const [category, setCategory] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setDocuments(null);
    setError(null);
    adminFetch(`/api/admin/contabilidade/documentos?year=${year}`)
      .then((result: { documents: Doc[] }) => setDocuments(result.documents))
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Não foi possível ler os documentos.'));
  }, [year]);

  useEffect(() => { setMonth(period); setCategory(null); }, [period]);

  const tree = useMemo(() => {
    const months = new Map<string, Map<string, Doc[]>>();
    for (const document of documents || []) {
      const categories = months.get(document.movement.period) || new Map<string, Doc[]>();
      categories.set(document.movement.category, [...(categories.get(document.movement.category) || []), document]);
      months.set(document.movement.period, categories);
    }
    return [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [documents]);

  const shown = useMemo(() => (documents || []).filter(document =>
    (!month || document.movement.period === month) && (!category || document.movement.category === category)), [documents, month, category]);

  const open = async (document: Doc) => {
    try {
      const { url } = await adminFetch(`/api/admin/contabilidade/documentos/${document.id}`);
      window.open(url, '_blank', 'noopener');
    } catch (openError) {
      toast({ tone: 'error', title: 'Não foi possível abrir', description: openError instanceof Error ? openError.message : undefined });
    }
  };

  const downloadMonth = async () => {
    if (!month) return;
    setZipping(true);
    try {
      await downloadAdminFile(`/api/admin/contabilidade/documentos/zip?period=${month}`, `documentos-${month}.zip`);
    } catch (zipError) {
      toast({ tone: 'error', title: 'Não foi possível descarregar', description: zipError instanceof Error ? zipError.message : undefined });
    } finally {
      setZipping(false);
    }
  };

  if (error) return <Card><EmptyState title="Não foi possível ler os documentos">{error}</EmptyState></Card>;
  if (!documents) return <Card className="flex items-center gap-2 p-6 text-[13px] text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A ler os documentos…</Card>;

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav className="h-fit lg:sticky lg:top-24" aria-label="Pastas">
        <p className="px-3 pb-2 text-[12.5px] font-semibold text-zinc-500">{year}</p>
        {tree.length === 0 && <p className="px-3 pb-2 text-[13px] text-zinc-400">Ainda sem documentos este ano.</p>}
        <div className="flex flex-col gap-0.5">
          {tree.map(([itemMonth, categories]) => {
            const active = month === itemMonth;
            const count = [...categories.values()].reduce((sum, list) => sum + list.length, 0);
            return (
              <div key={itemMonth}>
                <button type="button" onClick={() => { setMonth(itemMonth); setCategory(null); }}
                  className={cx('flex w-full items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-left text-[13.5px] transition-colors duration-150', active && !category ? 'bg-white font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(9,9,11,0.05),0_1px_2px_rgba(9,9,11,0.05)]' : 'text-zinc-600 hover:bg-zinc-900/[0.04]')}>
                  {active ? <FolderOpen className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden /> : <Folder className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
                  <span className="flex-1 truncate">{formatPeriod(itemMonth)}</span>
                  <span className="text-[12px] tabular-nums text-zinc-400">{count}</span>
                </button>
                {active && [...categories.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt')).map(([name, list]) => (
                  <button key={name} type="button" onClick={() => setCategory(name)}
                    className={cx('ml-4 mt-0.5 flex w-[calc(100%-1rem)] items-center gap-2 rounded-[9px] px-3 py-1 text-left text-[13px] transition-colors duration-150', category === name ? 'bg-white font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(9,9,11,0.05),0_1px_2px_rgba(9,9,11,0.05)]' : 'text-zinc-500 hover:bg-zinc-900/[0.04]')}>
                    <span className="flex-1 truncate">{name}</span>
                    <span className="text-[12px] tabular-nums text-zinc-400">{list.length}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </nav>

      <div>
        <header className="mb-2.5 flex min-h-8 flex-wrap items-center justify-between gap-3 px-1">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">
            {month ? formatPeriod(month) : 'Todos os meses'}{category ? ` · ${category}` : ''}
            <Count value={shown.length} />
          </h2>
          {month && (
            <Button size="sm" disabled={zipping || !shown.length} onClick={() => void downloadMonth()}>
              {zipping ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
              Descarregar ZIP
            </Button>
          )}
        </header>
        <Card className="overflow-hidden">
          {shown.length === 0 ? (
            <EmptyState title="Sem documentos aqui">Os ficheiros anexados às despesas aparecem nesta pasta.</EmptyState>
          ) : (
            <ul>
              {shown.map(document => (
                <li key={document.id} className="group/doc relative flex items-center gap-3.5 px-4 py-3 text-sm transition-colors duration-150 before:absolute before:left-[62px] before:right-0 before:top-0 before:h-px before:bg-zinc-900/[0.06] first:before:hidden hover:bg-zinc-900/[0.025]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-zinc-900/[0.05] text-zinc-500" aria-hidden>
                    <FileText className="h-4 w-4" />
                  </span>
                  <button type="button" onClick={() => onOpenMovement(document.movement.id, document.movement.period)} className="min-w-0 flex-1 text-left outline-none">
                    <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-zinc-900">{document.movement.who}</span>
                    <span className="block truncate text-[12.5px] text-zinc-400">{formatDay(document.movement.date, true)} · {document.movement.category} · {document.fileName}</span>
                  </button>
                  <span className="hidden shrink-0 rounded-full bg-zinc-900/[0.05] px-2.5 py-0.5 text-[12px] font-medium text-zinc-600 sm:inline">{document.kindLabel}</span>
                  <span className="w-24 shrink-0 text-right text-[14px] font-semibold tabular-nums text-zinc-900">{formatEur(document.movement.amount)}</span>
                  <IconButton label={`Abrir ${document.fileName || 'documento'}`} className="h-8 w-8" onClick={() => void open(document)}>
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
