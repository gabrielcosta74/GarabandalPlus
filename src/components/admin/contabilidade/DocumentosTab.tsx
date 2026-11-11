"use client";

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Camera, ChevronRight, Download, FileText, Folder, Image as ImageIcon, LoaderCircle, Mail, Search, X } from 'lucide-react';

import { formatDay, formatEur, formatPeriod } from '../../../lib/ledger/format';
import DocumentPreview, { type PreviewDoc } from './DocumentPreview';
import FilesBrowser from './FilesBrowser';
import MailInvoicesCard from './MailInvoicesCard';
import MovementRow from './MovementRow';
import { useToast } from './Toasts';
import type { LedgerMovement } from './types';
import { adminFetch, downloadAdminFile } from './useLedger';
import { BADGE, Button, Card, Count, EmptyState, Hint, IconButton, cx } from './ui';

type Doc = PreviewDoc & {
  kind: string;
  sizeBytes: number | null;
  createdAt: string;
  movement: PreviewDoc['movement'] & { description: string };
};

const KIND_ORDER = ['fatura', 'recibo', 'comprovativo', 'proforma', 'outro'];
const KIND_PLURAL: Record<string, string> = {
  fatura: 'Faturas', recibo: 'Recibos', comprovativo: 'Comprovativos', proforma: 'Proformas', outro: 'Outros',
};

/** Remembers whether the admin last looked at folders or months. */
const MODE_KEY = 'ledger:documents-mode:v1';

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Every file that justifies an expense, organised like the accountant's ZIP:
 * month → category. What still needs the admin (expenses without a file)
 * comes first; a click on a file previews it without leaving the page.
 */
export default function DocumentosTab({
  period,
  periods,
  missing,
  onPeriod,
  onOpenMovement,
  onCapture,
}: {
  /** Month loaded in the page; `missing` belongs to it. */
  period: string | null;
  periods: string[];
  missing: LedgerMovement[];
  onPeriod: (period: string) => void;
  onOpenMovement: (movementId: string, period: string) => void;
  onCapture?: () => void;
}) {
  const year = (period || new Date().toISOString()).slice(0, 4);
  const [documents, setDocuments] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(period);
  const [kind, setKind] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<'pastas' | 'meses'>('pastas');
  useEffect(() => {
    try { if (window.localStorage.getItem(MODE_KEY) === 'meses') setMode('meses'); } catch { /* storage blocked */ }
  }, []);
  const toast = useToast();

  useEffect(() => { setDocuments(null); }, [year]);
  useEffect(() => {
    setError(null);
    adminFetch(`/api/admin/contabilidade/documentos?year=${year}`)
      .then((result: { documents: Doc[] }) => setDocuments(result.documents))
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Não foi possível ler os documentos.'));
  }, [year, reload]);

  // The page's month moves (another tab, a movement opened elsewhere): follow it.
  useEffect(() => { setMonth(period); }, [period]);
  // A file attached in the drawer shortens `missing` for the same month: read the list again.
  const missingKey = `${period}|${missing.map(movement => movement.id).join(',')}`;
  const [lastMissingKey, setLastMissingKey] = useState(missingKey);
  useEffect(() => {
    if (missingKey === lastMissingKey) return;
    const samePeriod = missingKey.split('|')[0] === lastMissingKey.split('|')[0];
    setLastMissingKey(missingKey);
    if (samePeriod) setReload(value => value + 1);
  }, [missingKey, lastMissingKey]);

  const months = useMemo(() => {
    const counts = new Map<string, number>();
    periods.filter(item => item.startsWith(year)).forEach(item => counts.set(item, 0));
    (documents || []).forEach(doc => counts.set(doc.movement.period, (counts.get(doc.movement.period) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [documents, periods, year]);

  const inMonth = useMemo(() => (documents || []).filter(doc => !month || doc.movement.period === month), [documents, month]);

  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    inMonth.forEach(doc => counts.set(doc.kind, (counts.get(doc.kind) || 0) + 1));
    return KIND_ORDER.filter(item => counts.has(item)).map(item => ({ key: item, count: counts.get(item)! }));
  }, [inMonth]);
  useEffect(() => { if (kind && !kinds.some(item => item.key === kind)) setKind(null); }, [kind, kinds]);

  const shown = useMemo(() => {
    const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
    return inMonth.filter(doc => {
      if (kind && doc.kind !== kind) return false;
      if (!words.length) return true;
      const haystack = normalize([
        doc.movement.who, doc.movement.description, doc.movement.category, doc.fileName, doc.docNumber,
        doc.kindLabel, formatEur(doc.movement.amount), doc.source === 'email' ? 'email' : '',
      ].filter(Boolean).join(' '));
      return words.every(word => haystack.includes(word));
    });
  }, [inMonth, kind, query]);

  // Same order as on screen, so ← → in the preview walks the list as seen.
  const groups = useMemo(() => {
    const map = new Map<string, Doc[]>();
    shown.forEach(doc => map.set(doc.movement.category, [...(map.get(doc.movement.category) || []), doc]));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt'));
  }, [shown]);
  const ordered = useMemo(() => groups.flatMap(([, list]) => list), [groups]);

  const pickMonth = (next: string | null) => {
    setMonth(next);
    setPreviewIndex(null);
    if (next && next !== period) onPeriod(next);
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

  const chooseMode = (next: 'pastas' | 'meses') => {
    setMode(next);
    try { window.localStorage.setItem(MODE_KEY, next); } catch { /* private window: keep it for this visit only */ }
  };
  const switcher = (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="lg-pill inline-flex rounded-full p-1" role="tablist" aria-label="Como ver os documentos">
        {([['pastas', 'Pastas'], ['meses', 'Por mês']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => chooseMode(key)}
            className={cx('h-8 rounded-full px-4 text-[13px] font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-zinc-900/15',
              mode === key ? 'lg-thumb text-zinc-950' : 'text-zinc-500 hover:text-zinc-900')}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[12.5px] text-zinc-500">
        {mode === 'pastas' ? 'As suas pastas. Cada ficheiro mostra a que movimento do banco está ligado.' : 'Os documentos de cada mês, como no ZIP para o contabilista.'}
      </p>
    </div>
  );
  if (mode === 'pastas') {
    return (
      <div className="space-y-5">
        {switcher}
        <FilesBrowser missing={missing} period={period} onOpenMovement={onOpenMovement} />
      </div>
    );
  }
  const archiveEntry = switcher;

  if (error) return <div className="space-y-5">{archiveEntry}<Card><EmptyState title="Não foi possível ler os documentos">{error}</EmptyState></Card></div>;
  if (!documents) return <div className="space-y-5">{archiveEntry}<Card className="flex items-center gap-2 p-6 text-[13px] text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A ler os documentos…</Card></div>;

  const missingHere = month && month === period ? missing : [];
  const filtering = !!kind || !!query.trim();

  return (
    <div className="space-y-5">
      {archiveEntry}
      <div className="grid gap-5 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <nav className="h-fit lg:sticky lg:top-24" aria-label="Meses">
        <p className="px-3 pb-2 text-[12.5px] font-semibold text-zinc-500">{year}</p>
        <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
          <MonthButton label="Todo o ano" count={documents.length} active={month === null} onClick={() => pickMonth(null)} />
          {months.map(([item, count]) => (
            <MonthButton
              key={item}
              label={formatPeriod(item)}
              count={count}
              active={month === item}
              attention={item === period && missing.length > 0}
              onClick={() => pickMonth(item)}
            />
          ))}
        </div>
      </nav>

      <div className="flex min-w-0 flex-col gap-6">
        {missingHere.length > 0 && (
          <section>
            <header className="mb-2.5 flex min-h-8 flex-wrap items-center justify-between gap-3 px-1">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">
                Falta documento
                <Count value={missingHere.length} tone="attention" />
              </h2>
              {onCapture && (
                <Button size="sm" onClick={onCapture}>
                  <Camera className="h-3.5 w-3.5" aria-hidden /> Fotografar faturas
                </Button>
              )}
            </header>
            <Card className="overflow-hidden">
              {missingHere.map(movement => (
                <div key={movement.id} className="group/item">
                  <MovementRow
                    movement={movement}
                    onOpen={target => onOpenMovement(target.id, target.period)}
                    action={(
                      <Button size="sm" onClick={event => { event.stopPropagation(); onOpenMovement(movement.id, movement.period); }}>
                        Anexar
                      </Button>
                    )}
                  />
                </div>
              ))}
            </Card>
          </section>
        )}

        <MailInvoicesCard refreshKey={documents} />

        <section>
          <header className="mb-2.5 flex flex-col gap-2.5 px-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">
              {month ? formatPeriod(month) : `Todo o ${year}`}
              <Count value={shown.length} />
              <Hint>Clique num documento para o ver aqui. As pastas são as mesmas do ZIP que vai para o contabilista.</Hint>
            </h2>
            <div className="flex items-center gap-2">
              <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                <span className="sr-only">Procurar documentos</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Procurar"
                  className="lg-pill h-8 w-full rounded-full pl-9 pr-8 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700">
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </label>
              {month && (
                <Button size="sm" disabled={zipping || !inMonth.length} onClick={() => void downloadMonth()} title="Todos os documentos do mês, em pastas por categoria">
                  {zipping ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
                  ZIP
                </Button>
              )}
            </div>
          </header>

          {kinds.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5 px-1" role="tablist" aria-label="Tipo de documento">
              <KindChip label="Todos" count={inMonth.length} active={kind === null} onClick={() => setKind(null)} />
              {kinds.map(item => (
                <KindChip key={item.key} label={KIND_PLURAL[item.key] || item.key} count={item.count} active={kind === item.key} onClick={() => setKind(item.key)} />
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            <Card>
              <EmptyState title={filtering ? 'Nada encontrado' : 'Sem documentos aqui'}>
                {filtering ? 'Experimente outra palavra ou outro tipo.' : 'Os ficheiros anexados às despesas aparecem aqui.'}
              </EmptyState>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map(([category, list]) => (
                <div key={category}>
                  <p className="mb-1.5 flex items-center gap-2 px-1 text-[12.5px] font-medium text-zinc-500">
                    {category} <span className="tabular-nums text-zinc-400">{list.length}</span>
                  </p>
                  <Card className="overflow-hidden">
                    <ul>
                      {list.map(doc => (
                        <DocumentRow
                          key={doc.id}
                          doc={doc}
                          showMonth={!month}
                          onPreview={() => setPreviewIndex(ordered.indexOf(doc))}
                          onOpenMovement={() => onOpenMovement(doc.movement.id, doc.movement.period)}
                        />
                      ))}
                    </ul>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <DocumentPreview
        docs={ordered}
        index={previewIndex}
        onIndex={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
        onOpenMovement={doc => { setPreviewIndex(null); if (doc.movement) onOpenMovement(doc.movement.id, doc.movement.period); }}
      />
      </div>
    </div>
  );
}

function MonthButton({ label, count, active, attention = false, onClick }: { label: string; count: number; active: boolean; attention?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'flex shrink-0 items-center gap-2.5 rounded-full px-3 py-1.5 text-left text-[13.5px] outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15 lg:w-full',
        active ? 'lg-thumb font-medium text-zinc-950' : 'text-zinc-600 hover:bg-zinc-900/[0.05]',
      )}
    >
      <span className="flex-1 truncate">{label}</span>
      {attention && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" title="Há despesas sem documento" aria-label="Há despesas sem documento" />}
      <span className={cx('text-[12px] tabular-nums', active ? 'text-zinc-600' : 'text-zinc-400')}>{count}</span>
    </button>
  );
}

function KindChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium outline-none transition-[background-color,color,transform] duration-150 ease-out active:scale-95 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15',
        active ? 'lg-thumb text-zinc-950' : 'lg-pill text-zinc-500 hover:text-zinc-900',
      )}
    >
      {label}
      <span className={cx('tabular-nums', active ? 'text-zinc-600' : 'text-zinc-400')}>{count}</span>
    </button>
  );
}

function DocumentRow({ doc, showMonth, onPreview, onOpenMovement }: { doc: Doc; showMonth: boolean; onPreview: () => void; onOpenMovement: () => void }) {
  const image = (doc.mimeType || '').startsWith('image/');
  const Icon = image ? ImageIcon : FileText;
  return (
    <li className="group/doc relative flex items-center gap-3.5 px-4 py-3 transition-colors duration-150 before:pointer-events-none before:absolute before:left-[66px] before:right-0 before:top-0 before:h-px before:bg-zinc-900/[0.06] first:before:hidden hover:bg-zinc-900/[0.025]">
      <button type="button" onClick={onPreview} className="flex min-w-0 flex-1 items-center gap-3.5 text-left outline-none focus-visible:[&>span:last-child>span:first-child]:underline" aria-label={`Ver ${doc.fileName || 'documento'} de ${doc.movement.who}`}>
        <span className="lg-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600" aria-hidden>
          <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-zinc-900">{doc.movement.who}</span>
          <span className="block truncate text-[12.5px] text-zinc-400">
            <span className="text-zinc-500">{formatDay(doc.movement.date, showMonth)}</span> · {doc.fileName || 'Documento'}
          </span>
        </span>
      </button>
      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {doc.source === 'email' && (
          <span className={cx(BADGE, 'bg-zinc-900/[0.05] px-2 text-zinc-500')} title="Chegou sozinho pela caixa geral@">
            <Mail className="h-3 w-3" aria-hidden /> Email
          </span>
        )}
        <span className={cx(BADGE, 'bg-zinc-900/[0.05] text-zinc-600')}>{doc.kindLabel}</span>
      </span>
      <span className="w-[5.5rem] shrink-0 text-right text-[14px] font-semibold tabular-nums text-zinc-900">{formatEur(doc.movement.amount)}</span>
      <IconButton label="Ver movimento" className="h-8 w-8 opacity-70 group-hover/doc:opacity-100" onClick={onOpenMovement}>
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </IconButton>
    </li>
  );
}
