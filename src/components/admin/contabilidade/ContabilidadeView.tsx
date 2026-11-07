"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Ellipsis, FileUp, Landmark } from 'lucide-react';

import { requiresDocument } from '../../../lib/ledger/categories';
import { formatDay, formatEur, formatPeriod } from '../../../lib/ledger/format';
import FechoTab from './FechoTab';
import BankSyncStatus from './BankSyncStatus';
import ImportDialog from './ImportDialog';
import MovementDrawer from './MovementDrawer';
import MovimentosTab from './MovimentosTab';
import Overview from './Overview';
import AdminGuide from './AdminGuide';
import DocumentosTab from './DocumentosTab';
import PaymentsBankCheck from './PaymentsBankCheck';
import PorTratarTab from './PorTratarTab';
import { ToastProvider, useToast } from './Toasts';
import type { LedgerMovement } from './types';
import { adminFetch, useLedger } from './useLedger';
import QuickCapture from './QuickCapture';
import { Card, EmptyState, ErrorState, LoadingRows, cx, isOpen, missingDocument } from './ui';

type Tab = 'por-tratar' | 'movimentos' | 'documentos' | 'fecho';

const TABS: { key: Tab; label: string }[] = [
  { key: 'por-tratar', label: 'Por tratar' },
  { key: 'movimentos', label: 'Movimentos' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'fecho', label: 'Fecho do mês' },
];


function readTabFromUrl(): Tab {
  if (typeof window === 'undefined') return 'por-tratar';
  const value = new URLSearchParams(window.location.search).get('tab');
  return TABS.some(tab => tab.key === value) ? (value as Tab) : 'por-tratar';
}

/** The page shows one month at a time; this keeps the others from being forgotten. */
function OpenMonths({ counts, current, onPick }: { counts: Record<string, number>; current: string | null; onPick: (period: string) => void }) {
  const months = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  const total = months.reduce((sum, [, count]) => sum + count, 0);
  if (months.length < 2) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[13px] text-zinc-500">{total} por tratar em {months.length} meses:</span>
      {months.map(([period, count]) => (
        <button
          key={period}
          type="button"
          onClick={() => onPick(period)}
          aria-current={period === current ? 'true' : undefined}
          className={cx(
            'rounded-full px-3 py-1 text-[13px] font-medium transition-all duration-200 ease-out active:scale-[0.97]',
            period === current ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50',
          )}
        >
          {formatPeriod(period)} <span className="tabular-nums opacity-70">{count}</span>
        </button>
      ))}
    </div>
  );
}

export default function ContabilidadeView() {
  return (
    <ToastProvider>
      <Contabilidade />
    </ToastProvider>
  );
}

function Contabilidade() {
  const ledger = useLedger();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('por-tratar');
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A fixed list while photographing, so the queue does not jump as each one is saved.
  const [captureList, setCaptureList] = useState<LedgerMovement[] | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { setTab(readTabFromUrl()); }, []);

  const selected = useMemo(
    () => (selectedId ? ledger.movements.find(movement => movement.id === selectedId) || null : null),
    [ledger.movements, selectedId],
  );
  const openMovement = useCallback((movement: LedgerMovement) => setSelectedId(movement.id), []);

  const changeTab = useCallback((next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url.toString());
  }, []);

  const openCount = useMemo(() => ledger.movements.filter(movement => isOpen(movement) || missingDocument(movement)).length, [ledger.movements]);

  // Months are listed newest first; "previous" goes back in time.
  const periodIndex = ledger.period ? ledger.periods.indexOf(ledger.period) : -1;
  const olderPeriod = periodIndex >= 0 ? ledger.periods[periodIndex + 1] : undefined;
  const newerPeriod = periodIndex > 0 ? ledger.periods[periodIndex - 1] : undefined;

  const approve = useCallback(async (rows: LedgerMovement[]) => {
    setBulkError(null);
    const total = rows.length === 1 ? formatEur(rows[0].amount, { signed: true }) : 'Comissões, imposto do selo e liquidações';
    const title = rows.length === 1 ? 'Movimento aprovado' : `${rows.length} movimentos aprovados`;
    if (ledger.isLocal) {
      const snapshots = rows.map(row => ({ id: row.id, status: row.status, needsDocument: row.needsDocument, reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt }));
      rows.forEach(row => ledger.updateLocal(row.id, {
        status: 'reconciled',
        needsDocument: requiresDocument(row.categoryCode),
        reviewedBy: 'você',
        reviewedAt: new Date().toISOString(),
      }));
      toast({
        title,
        description: total,
        action: { label: 'Desfazer', onClick: () => snapshots.forEach(({ id, ...rest }) => ledger.updateLocal(id, rest)) },
      });
      return;
    }
    let done = 0;
    for (const row of rows) {
      try {
        await adminFetch(`/api/admin/contabilidade/movimentos/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            categoryCode: row.categoryCode || row.suggestedCategoryCode,
            invoiceRef: row.suggestion?.confidence === 'manual' ? row.suggestion.invoiceRef : undefined,
          }),
        });
        done += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao aprovar.';
        setBulkError(message);
        toast({ tone: 'error', title: `Parou em ${done} de ${rows.length}`, description: message });
        break;
      }
    }
    if (done === rows.length) toast({ title, description: total });
    ledger.reload();
  }, [ledger, toast]);

  const syncBank = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await adminFetch('/api/admin/contabilidade/sincronizar', { method: 'POST' });
      if (result.status === 'synced') {
        const count = Number(result.rowsNew || 0);
        toast({ title: count ? `${count} ${count === 1 ? 'movimento novo' : 'movimentos novos'}` : 'Sem movimentos novos', description: 'Montepio atualizado agora.' });
      } else if (result.status === 'rate_limited') {
        toast({ tone: 'info', title: 'O Montepio limitou as consultas de hoje', description: 'Pode importar o extrato do Montepio Net, se precisar já.' });
      } else if (result.status === 'waiting') {
        toast({ tone: 'info', title: 'Consultado há instantes', description: 'Aguarde um minuto e tente de novo.' });
      } else {
        toast({ tone: 'info', title: 'O banco não respondeu', description: 'Os movimentos já guardados continuam disponíveis.' });
      }
      ledger.reload();
    } catch (error) {
      toast({ tone: 'error', title: 'Falhou a sincronização', description: error instanceof Error ? error.message : 'Tente novamente mais tarde.' });
      ledger.reload();
    } finally {
      setSyncing(false);
    }
  }, [ledger, toast]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full bg-white p-1 ring-1 ring-zinc-200">
            <button
              type="button"
              disabled={!olderPeriod}
              onClick={() => olderPeriod && ledger.setPeriod(olderPeriod)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-all duration-200 ease-out hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 disabled:text-zinc-200 disabled:hover:bg-transparent"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[9.5rem] px-2 text-center text-[15px] font-semibold text-zinc-900">
              {ledger.period ? formatPeriod(ledger.period) : '—'}
            </span>
            <button
              type="button"
              disabled={!newerPeriod}
              onClick={() => newerPeriod && ledger.setPeriod(newerPeriod)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-all duration-200 ease-out hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 disabled:text-zinc-200 disabled:hover:bg-transparent"
              aria-label="Mês seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {ledger.mode === 'demo' && (
            <span className="rounded-full bg-zinc-900/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-500" title="Nomes e valores inventados. Nada é guardado.">
              Exemplo
            </span>
          )}
          {ledger.mode === 'preview' && (
            <span className="rounded-full bg-zinc-900/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-500" title={`Pré-visualização de ${ledger.previewFileName}. Nada é guardado.`}>
              Pré-visualização
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-white pl-1.5 pr-4 text-sm ring-1 ring-zinc-200">
            <span className={cx('flex h-7 w-7 items-center justify-center rounded-full', ledger.mode === 'bank' ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-500')} aria-hidden>
              <Landmark className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium text-zinc-900">Montepio</span>
            {ledger.mode === 'bank' || ledger.bank ? (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                {ledger.bank?.fetchedAt ? 'ligado' : 'por sincronizar'}{ledger.bank?.validUntil ? ` até ${formatDay(ledger.bank.validUntil.slice(0, 10), true)}` : ''}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" aria-hidden />
                por ligar
              </span>
            )}
          </span>
          <Menu as="div" className="relative">
            <MenuButton className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-500 ring-1 ring-zinc-200 transition-all duration-200 ease-out hover:bg-zinc-50 hover:text-zinc-900 hover:ring-zinc-300 active:scale-95 data-[open]:bg-zinc-900 data-[open]:text-white data-[open]:ring-zinc-900" aria-label="Mais opções">
              <Ellipsis className="h-4 w-4" />
            </MenuButton>
            <MenuItems
              transition
              anchor="bottom end"
              className="z-40 mt-2 w-64 origin-top-right rounded-2xl bg-white p-1.5 shadow-xl shadow-zinc-900/10 ring-1 ring-zinc-900/5 transition duration-150 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
            >
              <MenuItem>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 data-[focus]:bg-zinc-100/70"
                >
                  <FileUp className="mt-0.5 h-4 w-4 text-zinc-500" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium text-zinc-900">Importar ficheiro</span>
                    <span className="block text-xs text-zinc-500">Extrato do Montepio Net, se a ligação falhar</span>
                  </span>
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
      </div>

      {(ledger.mode === 'bank' || ledger.mode === 'live') && (
        <BankSyncStatus
          bank={ledger.bank}
          syncing={syncing || (ledger.mode === 'bank' && ledger.loading)}
          onSync={ledger.mode === 'bank' ? ledger.refreshFromBank : () => void syncBank()}
          onImport={() => setImportOpen(true)}
        />
      )}

      {ledger.error ? (
        <ErrorState message={ledger.error} onRetry={ledger.reload} />
      ) : ledger.loading ? (
        <LoadingRows />
      ) : (
        <>
          <Overview movements={ledger.movements} previous={ledger.previous} monthBalance={ledger.monthBalance} onOpenTodo={() => changeTab('por-tratar')} />

          {/* Tabs */}
          <div className="flex items-center justify-between gap-4">
            <nav className="inline-flex rounded-2xl bg-zinc-900/[0.04] p-1" aria-label="Secções da contabilidade">
              {TABS.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => changeTab(item.key)}
                  aria-current={tab === item.key ? 'page' : undefined}
                  className={cx(
                    'relative inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500/40',
                    tab === item.key ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-900',
                  )}
                >
                  {tab === item.key && (
                    <motion.span
                      layoutId="ledger-tab"
                      className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-zinc-900/5"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                  {item.key === 'por-tratar' && openCount > 0 && (
                    <motion.span
                      key={openCount}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative rounded-full bg-orange-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-white"
                    >
                      {openCount}
                    </motion.span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {bulkError && <ErrorState message={bulkError} />}

          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
          {tab === 'por-tratar' && <AdminGuide issuing={!!ledger.bank?.donationIssueFrom} />}
          {tab === 'por-tratar' && (
            <OpenMonths counts={ledger.openByPeriod} current={ledger.period} onPick={ledger.setPeriod} />
          )}
          {tab === 'por-tratar' && ledger.mode === 'live' && <PaymentsBankCheck refreshKey={ledger.movements} />}
          {tab === 'por-tratar' ? (
            <PorTratarTab
              movements={ledger.movements}
              selectedId={selectedId}
              readOnlyReason={ledger.readOnlyReason}
              onOpen={openMovement}
              onApprove={rows => void approve(rows)}
              onQuickCapture={ledger.mode === 'live' && !ledger.readOnlyReason ? () => setCaptureList(ledger.movements.filter(missingDocument)) : undefined}
            />
          ) : tab === 'documentos' ? (
            ledger.mode === 'live'
              ? <DocumentosTab period={ledger.period} onOpenMovement={(id, docPeriod) => { if (docPeriod !== ledger.period) ledger.setPeriod(docPeriod); setSelectedId(id); }} />
              : <Card><EmptyState title="Os documentos aparecem com os movimentos reais" /></Card>
          ) : tab === 'movimentos' ? (
            <MovimentosTab movements={ledger.movements} selectedId={selectedId} onOpen={openMovement} monthBalance={ledger.monthBalance} />
          ) : (
            <FechoTab
              period={ledger.period}
              movements={ledger.movements}
              readOnlyReason={ledger.readOnlyReason}
              closedBy={ledger.closed}
              onGo={changeTab}
              monthBalance={ledger.monthBalance}
              live={ledger.mode === 'live'}
              onChanged={ledger.reload}
            />
          )}
          </motion.div>
        </>
      )}

      <QuickCapture
        open={!!captureList}
        movements={captureList || []}
        onClose={() => setCaptureList(null)}
        onChanged={ledger.reload}
      />

      <MovementDrawer
        movement={selected}
        readOnlyReason={ledger.readOnlyReason}
        onClose={() => setSelectedId(null)}
        onChanged={ledger.reload}
        onLocalChange={ledger.isLocal ? ledger.updateLocal : undefined}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onPreview={ledger.showStoredPreview}
        onImported={ledger.reload}
      />
    </div>
  );
}
