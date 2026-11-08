"use client";

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import { formatDay } from '../../../lib/ledger/format';
import type { LedgerMovement } from './types';
import { Amount, BADGE, CategoryPill, IconTile, StatePill, cx, effectiveCategory, movementTitle } from './ui';

/**
 * One bank movement as a list row: icon, who/what with the bank's words in
 * grey, category, state and amount. Hairlines are inset past the icon, so a
 * list reads as one sheet rather than a stack of boxes.
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
        'group/row relative grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 px-4 py-3 outline-none',
        'transition-colors duration-150 ease-out',
        'md:grid-cols-[auto_minmax(0,1fr)_11rem_9rem_7.5rem_2rem] md:gap-x-4',
        // Inset hairline above every row but the first.
        'before:pointer-events-none before:absolute before:left-[66px] before:right-0 before:top-0 before:h-px before:bg-zinc-900/[0.06]',
        'group-first/item:before:hidden',
        active ? 'bg-zinc-900/[0.045]' : 'hover:bg-zinc-900/[0.025] focus-visible:bg-zinc-900/[0.035]',
        movement.status === 'ignored' && 'opacity-55',
      )}
    >
      <IconTile code={code} dashed={tentative} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium tracking-[-0.01em] text-zinc-900">{movementTitle(movement)}</p>
        <p className="truncate text-[12.5px] text-zinc-400">
          {showDate && <span className="text-zinc-500">{formatDay(movement.bookingDate)}</span>}
          {showDate && ' · '}
          {movement.description}
        </p>
      </div>
      <div className="hidden min-w-0 md:block"><CategoryPill code={code} tentative={tentative} /></div>
      <div className="hidden min-w-0 md:block"><RowBadge movement={movement} /></div>
      <Amount value={movement.amount} className="text-right text-[14px]" />
      <div className="col-span-3 flex items-center justify-between gap-2 pl-[50px] md:col-span-1 md:justify-end md:pl-0">
        <div className="flex min-w-0 items-center gap-3 md:hidden">
          <CategoryPill code={code} tentative={tentative} />
          <RowBadge movement={movement} />
        </div>
        {action ?? <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition-[transform,color] duration-150 ease-out group-hover/row:translate-x-0.5 group-hover/row:text-zinc-400" aria-hidden />}
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
  const good = cx(BADGE, 'bg-emerald-500/10 text-emerald-700');
  const info = cx(BADGE, 'bg-sky-500/10 text-sky-700');
  if (open && movement.appInvoiceRef) {
    return <span className={good} title="Ligada ao pagamento registado no site; a FR já foi emitida pela app.">{movement.appInvoiceRef} · app</span>;
  }
  if (open && movement.appInvoiceState === 'failed') {
    return <span className={cx(BADGE, 'bg-rose-500/10 text-rose-700')} title="A FR não foi emitida. Reveja-a em Faturação.">FR falhou</span>;
  }
  if (open && movement.appInvoiceState === 'processing') {
    return <span className={info} title="A FR sai dentro de minutos. Não a emita noutro sítio.">FR a ser emitida</span>;
  }
  if (open && movement.suggestion?.confidence === 'manual' && movement.suggestion.invoiceRef) {
    return <span className={good} title={movement.suggestion.reason}>{movement.suggestion.invoiceRef}</span>;
  }
  if (open && movement.suggestion?.confidence === 'learned') {
    return <span className={info} title={movement.suggestion.reason}>Pagador conhecido</span>;
  }
  if (open && ['likely', 'manual_likely'].includes(movement.suggestion?.confidence || '') && movement.suggestion?.invoiceRef) {
    return <span className={info} title={movement.suggestion.reason}>Provável {movement.suggestion.invoiceRef}</span>;
  }
  if (open && movement.suggestion?.confidence === 'ambiguous') {
    return <span className={cx(BADGE, 'bg-orange-500/10 text-orange-700')} title={movement.suggestion.reason}>{movement.suggestion.invoiceRefs.length} FRs possíveis</span>;
  }
  return <StatePill movement={movement} />;
}
