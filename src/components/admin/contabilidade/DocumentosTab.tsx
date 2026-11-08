"use client";

import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Folder, FolderOpen, LoaderCircle } from 'lucide-react';

import { formatDay, formatEur, formatPeriod } from '../../../lib/ledger/format';
import { useToast } from './Toasts';
import { adminFetch, downloadAdminFile } from './useLedger';
import MailInvoicesCard from './MailInvoicesCard';
import { Button, Card, EmptyState, cx } from './ui';

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
  if (!documents) return <Card className="flex items-center gap-2 p-6 text-sm text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A ler os documentos…</Card>;

  return (
    <div className="flex flex-col gap-4">
    <MailInvoicesCard refreshKey={documents} />
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Card className="h-fit p-3">
        <p className="px-2 pb-2 pt-1 text-[13px] font-semibold text-zinc-900">{year}</p>
        {tree.length === 0 && <p className="px-2 pb-2 text-[13px] text-zinc-500">Ainda sem documentos este ano.</p>}
        {tree.map(([itemMonth, categories]) => {
          const active = month === itemMonth;
          const count = [...categories.values()].reduce((sum, list) => sum + list.length, 0);
          return (
            <div key={itemMonth}>
              <button type="button" onClick={() => { setMonth(itemMonth); setCategory(null); }}
                className={cx('flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition-colors duration-200', active && !category ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100')}>
                {active ? <FolderOpen className="h-4 w-4 shrink-0" aria-hidden /> : <Folder className="h-4 w-4 shrink-0" aria-hidden />}
                <span className="flex-1 truncate">{formatPeriod(itemMonth)}</span>
                <span className="text-xs tabular-nums opacity-70">{count}</span>
              </button>
              {active && [...categories.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt')).map(([name, list]) => (
                <button key={name} type="button" onClick={() => setCategory(name)}
                  className={cx('ml-5 flex w-[calc(100%-1.25rem)] items-center gap-2 rounded-lg px-2 py-1 text-left text-[13px] transition-colors duration-200', category === name ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100')}>
                  <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{name}</span>
                  <span className="text-xs tabular-nums opacity-70">{list.length}</span>
                </button>
              ))}
            </div>
          );
        })}
      </Card>

      <Card className="overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">{month ? formatPeriod(month) : 'Todos os meses'}{category ? ` · ${category}` : ''}</h2>
            <p className="text-[13px] text-zinc-500">{shown.length} {shown.length === 1 ? 'documento' : 'documentos'}</p>
          </div>
          {month && (
            <Button size="sm" disabled={zipping || !shown.length} onClick={() => void downloadMonth()}>
              {zipping ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
              Descarregar o mês (ZIP)
            </Button>
          )}
        </header>
        {shown.length === 0 ? (
          <EmptyState title="Sem documentos aqui">Os ficheiros anexados às despesas aparecem nesta pasta.</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
            {shown.map(document => (
              <li key={document.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                <button type="button" onClick={() => onOpenMovement(document.movement.id, document.movement.period)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium text-zinc-900 hover:underline">{document.movement.who}</span>
                  <span className="block truncate text-[13px] text-zinc-500">{formatDay(document.movement.date, true)} · {document.movement.category} · {document.fileName}</span>
                </button>
                <span className="hidden shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 sm:inline">{document.kindLabel}</span>
                <span className="shrink-0 font-medium tabular-nums text-zinc-900">{formatEur(document.movement.amount)}</span>
                <button type="button" onClick={() => void open(document)} aria-label={`Abrir ${document.fileName || 'documento'}`} className="rounded-lg p-1.5 text-zinc-500 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-900">
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
    </div>
  );
}
