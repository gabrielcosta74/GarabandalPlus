"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { requiresDocument } from '../../../lib/ledger/categories';
import { formatEur, formatPeriod } from '../../../lib/ledger/format';
import FechoTab from './FechoTab';
import BankSyncStatus, { BankAlerts } from './BankSyncStatus';
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
import { Card, Count, EmptyState, ErrorState, IconButton, LoadingRows, SPRING, cx, isOpen, missingDocument } from './ui';

type Tab = 'por-tratar' | 'movimentos' | 'documentos' | 'fecho';

const TABS: { key: Tab; label: string }[] = [
  { key: 'por-tratar', label: 'Por tratar' },
  { key: 'movimentos', label: 'Movimentos' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'fecho', label: 'Fecho' },
];


function readTabFromUrl(): Tab {
  if (typeof window === 'undefined') return 'por-tratar';
  const value = new URLSearchParams(window.location.search).get('tab');
  return TABS.some(tab => tab.key === value) ? (value as Tab) : 'por-tratar';
}

/** The page shows one month at a time; one quiet button keeps the others from being forgotten. */
function OpenMonths({ counts, current, onPick }: { counts: Record<string, number>; current: string | null; onPick: (period: string) => void }) {
  const others = Object.entries(counts).filter(([period, count]) => period !== current && count > 0).sort(([a], [b]) => b.localeCompare(a));
  if (others.length === 0) return null;
  const total = others.reduce((sum, [, count]) => sum + count, 0);
  return (
    <Menu as="div" className="relative">
      <MenuButton className="lg-pill flex h-9 items-center gap-2 rounded-full pl-3.5 pr-3 text-[14px] font-medium text-zinc-600 outline-none transition-colors duration-150 hover:text-zinc-900 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15">
        <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden />
        <span className="tabular-nums">{total}</span> noutros meses
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
      </MenuButton>
      <MenuItems
        transition
        anchor={{ to: 'bottom end', gap: 8 }}
        className="lg-float z-50 w-60 origin-top-right rounded-2xl p-1.5 transition duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        {others.map(([period, count]) => (
          <MenuItem key={period}>
            <button
              type="button"
              onClick={() => onPick(period)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] text-zinc-900 transition-colors duration-100 data-[focus]:bg-zinc-900/[0.06]"
            >
              {formatPeriod(period)}
              <Count value={count} tone="attention" />
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

/** ‹ Month › with the month itself opening a list of every month and what is left in each. */
function MonthSwitcher({
  periods,
  period,
  openByPeriod,
  onPick,
}: {
  periods: string[];
  period: string | null;
  openByPeriod: Record<string, number>;
  onPick: (period: string) => void;
}) {
  // Months are listed newest first; "previous" goes back in time.
  const index = period ? periods.indexOf(period) : -1;
  const older = index >= 0 ? periods[index + 1] : undefined;
  const newer = index > 0 ? periods[index - 1] : undefined;
  const elsewhere = Object.entries(openByPeriod).some(([p, count]) => p !== period && count > 0);

  return (
    <div className="lg-pill flex items-center rounded-full p-0.5">
      <IconButton label="Mês anterior" className="h-8 w-8" disabled={!older} onClick={() => older && onPick(older)}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </IconButton>
      <Menu as="div" className="relative">
        <MenuButton className="relative flex h-8 min-w-[8rem] items-center sm:min-w-[9.5rem] justify-center gap-1.5 rounded-full px-3 text-[14px] font-semibold tracking-[-0.01em] text-zinc-900 outline-none transition-colors duration-150 hover:bg-zinc-900/[0.04] focus-visible:ring-[3px] focus-visible:ring-zinc-900/15 data-[open]:bg-zinc-900/[0.06]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={period || 'none'}
              initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
              transition={SPRING}
            >
              {period ? formatPeriod(period) : '—'}
            </motion.span>
          </AnimatePresence>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          {elsewhere && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500" title="Há outros meses por tratar" aria-hidden />}
        </MenuButton>
        <MenuItems
          transition
          anchor={{ to: 'bottom', gap: 8 }}
          className="lg-float z-50 max-h-80 w-56 origin-top overflow-y-auto rounded-2xl p-1.5 transition duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          {periods.map(item => (
            <MenuItem key={item}>
              <button
                type="button"
                onClick={() => onPick(item)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-zinc-900 transition-colors duration-100 data-[focus]:bg-zinc-900/[0.05]"
              >
                <span className="flex w-4 justify-center text-zinc-900" aria-hidden>{item === period && <Check className="h-3.5 w-3.5" strokeWidth={2.75} />}</span>
                <span className={cx('flex-1', item === period && 'font-semibold')}>{formatPeriod(item)}</span>
                {(openByPeriod[item] || 0) > 0 && <Count value={openByPeriod[item]} tone="attention" />}
              </button>
            </MenuItem>
          ))}
        </MenuItems>
      </Menu>
      <IconButton label="Mês seguinte" className="h-8 w-8" disabled={!newer} onClick={() => newer && onPick(newer)}>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </IconButton>
    </div>
  );
}

function Segmented({ tab, openCount, onChange }: { tab: Tab; openCount: number; onChange: (tab: Tab) => void }) {
  return (
    <nav className="lg-pill flex max-w-full overflow-x-auto rounded-full p-1 [scrollbar-width:none]" aria-label="Secções da contabilidade">
      {TABS.map(item => {
        const active = tab === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium tracking-[-0.005em] outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15',
              active ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-800',
            )}
          >
            {active && (
              <motion.span
                layoutId="ledger-tab"
                className="lg-thumb absolute inset-0 rounded-full"
                transition={SPRING}
              />
            )}
            <span className="relative">{item.label}</span>
            {item.key === 'por-tratar' && openCount > 0 && (
              <motion.span key={openCount} className="relative" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}>
                <Count value={openCount} tone="attention" />
              </motion.span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default function ContabilidadeView() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Contabilidade />
      </ToastProvider>
    </MotionConfig>
  );
}

/** Dark theme for the whole page while it is open, portalled dialogs included. */
function useLedgerTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('ledger-dark');
    return () => root.classList.remove('ledger-dark');
  }, []);
}

function Contabilidade() {
  useLedgerTheme();
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

  const showOverview = tab === 'por-tratar' || tab === 'movimentos';

  return (
    <div className="relative isolate flex flex-col gap-5 pb-10">
      <div className="lg-ambient pointer-events-none absolute -inset-x-8 -top-8 -z-10 h-[720px] md:-inset-x-12" aria-hidden />
      {/* Toolbar: a translucent layer the page scrolls under. */}
      <div
        className={cx(
          'relative z-30 -mx-6 -mt-6 px-6 pb-3 pt-6 md:sticky md:-top-5 md:-mx-8 md:-mt-8 md:px-8 md:pt-8',
          'bg-gray-50/55 backdrop-blur-2xl backdrop-saturate-150',
          'after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-gray-50/55 after:to-transparent',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <MonthSwitcher periods={ledger.periods} period={ledger.period} openByPeriod={ledger.openByPeriod} onPick={ledger.setPeriod} />
          {ledger.mode === 'demo' && (
            <span className="lg-pill rounded-full px-2.5 py-1 text-[12px] font-medium text-zinc-500" title="Nomes e valores inventados. Nada é guardado.">
              Exemplo
            </span>
          )}
          {ledger.mode === 'preview' && (
            <span className="rounded-full bg-zinc-900/[0.06] px-2.5 py-1 text-[12px] font-medium text-zinc-500" title={`Pré-visualização de ${ledger.previewFileName}. Nada é guardado.`}>
              Pré-visualização
            </span>
          )}

          <div className="order-last w-full lg:order-none lg:flex lg:w-auto lg:flex-1 lg:justify-center">
            <Segmented tab={tab} openCount={openCount} onChange={changeTab} />
          </div>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            <BankSyncStatus
              bank={ledger.bank}
              connected={ledger.mode === 'bank' || !!ledger.bank}
              canSync={ledger.mode === 'bank' || ledger.mode === 'live'}
              syncing={syncing || (ledger.mode === 'bank' && ledger.loading)}
              onSync={ledger.mode === 'bank' ? ledger.refreshFromBank : () => void syncBank()}
              onImport={() => setImportOpen(true)}
            />
            <AdminGuide issuing={!!ledger.bank?.donationIssueFrom} />
          </div>
        </div>
      </div>

      {(ledger.mode === 'bank' || ledger.mode === 'live') && <BankAlerts bank={ledger.bank} onImport={() => setImportOpen(true)} />}

      {ledger.error ? (
        <ErrorState message={ledger.error} onRetry={ledger.reload} />
      ) : ledger.loading ? (
        <LoadingRows />
      ) : (
        <>
          {bulkError && <ErrorState message={bulkError} />}

          <AnimatePresence initial={false}>
            {showOverview && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRING}
                className="-m-4 overflow-hidden p-4"
              >
                <Overview movements={ledger.movements} previous={ledger.previous} monthBalance={ledger.monthBalance} onOpenTodo={() => changeTab('por-tratar')} />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            className="flex flex-col gap-5"
          >
            {tab === 'por-tratar' ? (
              <PorTratarTab
                movements={ledger.movements}
                selectedId={selectedId}
                readOnlyReason={ledger.readOnlyReason}
                onOpen={openMovement}
                onApprove={rows => void approve(rows)}
                onQuickCapture={ledger.mode === 'live' && !ledger.readOnlyReason ? () => setCaptureList(ledger.movements.filter(missingDocument)) : undefined}
                aside={<OpenMonths counts={ledger.openByPeriod} current={ledger.period} onPick={ledger.setPeriod} />}
                notices={ledger.mode === 'live' ? <PaymentsBankCheck refreshKey={ledger.movements} /> : null}
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
