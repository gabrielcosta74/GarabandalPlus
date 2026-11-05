"use client";

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import { formatDay } from '../../../lib/ledger/format';
import type { LedgerMovement } from './types';
import { Amount, CategoryPill, IconTile, StatePill, cx, effectiveCategory, movementTitle } from './ui';

/**
 * One bank movement as a row: category icon, who/what, the bank's own words
 * in grey, the category pill, its state and the amount.
 */
export default function MovementRow({
  movement,
  onOpen,
  active = false,
  showDate = true,
  action,
}: {
  movement: LedgerMovement;
  onOpen: (movement: LedgerMovement) => void;
  active?: boolean;
  showDate?: boolean;
  action?: ReactNode;
}) {
  const code = effectiveCategory(movement);
  const tentative = !movement.categoryCode;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(movement)}
      onKeyDown={event => { if (event.key === 'Enter') onOpen(movement); }}
      className={cx(
        'group relative grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 outline-none transition-colors duration-200 ease-out',
        'before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-emerald-500 before:opacity-0 before:transition-opacity before:duration-200',
        'focus-visible:before:opacity-100',
        'md:grid-cols-[auto_minmax(0,1fr)_10.5rem_8.5rem_7.5rem_auto]',
        active ? 'bg-zinc-50 before:opacity-100' : 'hover:bg-zinc-50/80 focus-visible:bg-zinc-50',
        movement.status === 'ignored' && 'opacity-60',
      )}
    >
      <IconTile code={code} dashed={tentative} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900 transition-colors duration-200 group-hover:text-zinc-950">{movementTitle(movement)}</p>
        <p className="truncate text-[13px] text-zinc-400">
          {showDate && <>{formatDay(movement.bookingDate)} · </>}
          {movement.description}
        </p>
      </div>
      <div className="hidden min-w-0 md:block"><CategoryPill code={code} tentative={tentative} /></div>
      <div className="hidden md:block"><RowBadge movement={movement} /></div>
      <Amount value={movement.amount} className="text-right text-sm" />
      <div className="col-span-3 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
        <div className="flex items-center gap-2 md:hidden">
          <CategoryPill code={code} tentative={tentative} />
          <RowBadge movement={movement} />
        </div>
        {action ?? <ChevronRight className="h-4 w-4 text-zinc-300 transition-all duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-zinc-500" aria-hidden />}
      </div>
    </div>
  );
}

/**
 * What the cross-check with the site's invoices found, in plain words;
 * otherwise the usual state ("Sem FR ligada", "Completo"…).
 */
function RowBadge({ movement }: { movement: LedgerMovement }) {
  const open = movement.status === 'unreviewed' || movement.status === 'suggested';
  const base = 'inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset';
  if (open && movement.appInvoiceRef) {
    return <span className={cx(base, 'bg-emerald-50 text-emerald-700 ring-emerald-600/10')} title="Ligada ao pagamento registado no site; a FR já foi emitida pela app.">{movement.appInvoiceRef} · app</span>;
  }
  if (open && movement.appInvoiceState === 'failed') {
    return <span className={cx(base, 'bg-rose-50 text-rose-700 ring-rose-600/10')} title="A FR não foi emitida. Reveja-a em Faturação.">FR falhou</span>;
  }
  if (open && movement.appInvoiceState === 'processing') {
    return <span className={cx(base, 'bg-sky-50 text-sky-700 ring-sky-600/10')} title="A FR sai dentro de minutos. Não a emita noutro sítio.">FR a ser emitida</span>;
  }
  if (open && movement.suggestion?.confidence === 'manual' && movement.suggestion.invoiceRef) {
    return <span className={cx(base, 'bg-emerald-50 text-emerald-700 ring-emerald-600/10')} title={movement.suggestion.reason}>{movement.suggestion.invoiceRef}</span>;
  }
  if (open && movement.suggestion?.confidence === 'learned') {
    return <span className={cx(base, 'bg-sky-50 text-sky-700 ring-sky-600/10')} title={movement.suggestion.reason}>Pagador conhecido</span>;
  }
  if (open && ['likely', 'manual_likely'].includes(movement.suggestion?.confidence || '') && movement.suggestion?.invoiceRef) {
    return <span className={cx(base, 'bg-sky-50 text-sky-700 ring-sky-600/10')} title={movement.suggestion.reason}>Provável {movement.suggestion.invoiceRef}</span>;
  }
  if (open && movement.suggestion?.confidence === 'ambiguous') {
    return <span className={cx(base, 'bg-orange-50 text-orange-700 ring-orange-600/10')} title={movement.suggestion.reason}>{movement.suggestion.invoiceRefs.length} FRs possíveis</span>;
  }
  return <StatePill movement={movement} />;
}
