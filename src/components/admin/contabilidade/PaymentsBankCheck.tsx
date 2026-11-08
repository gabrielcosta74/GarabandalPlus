"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Files, ShieldAlert, ShieldCheck } from 'lucide-react';

import { formatDay, formatEur } from '../../../lib/ledger/format';
import { adminFetch } from './useLedger';
import { Card, Count, Hint } from './ui';

type Check = {
  checked: number;
  waiting: number;
  missing: { id: string; amount: number; paidOn: string; label: string; href: string }[];
  repeated?: { invoiceRefs: string[]; amount: number; date: string; client: string | null }[];
};

/** Payments marked as paid with no money in the bank. Quiet when everything agrees. */
export default function PaymentsBankCheck({ refreshKey }: { refreshKey: unknown }) {
  const [check, setCheck] = useState<Check | null>(null);
  useEffect(() => {
    let active = true;
    void adminFetch('/api/admin/contabilidade/verificacao')
      .then((result: Check) => { if (active) setCheck(result); })
      .catch(() => { if (active) setCheck(null); });
    return () => { active = false; };
  }, [refreshKey]);

  return check ? <PaymentsBankCheckView check={check} /> : null;
}

export function PaymentsBankCheckView({ check }: { check: Check }) {
  return (
    <>
      <RepeatedInvoices rows={check.repeated || []} />
      <MoneyCheck check={check} />
    </>
  );
}

function AlertList({ tone, title, hint, count, children }: { tone: 'orange' | 'rose'; title: string; hint: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <header className="mb-2.5 flex min-h-8 items-center gap-2 px-1">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">
          <span className={tone === 'rose' ? 'text-rose-500' : 'text-orange-500'} aria-hidden>
            {tone === 'rose' ? <ShieldAlert className="h-4 w-4" /> : <Files className="h-4 w-4" />}
          </span>
          {title}
          <Count value={count} />
          <Hint>{hint}</Hint>
        </h2>
      </header>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  );
}

const ALERT_ROW = 'group relative flex items-center justify-between gap-4 px-4 py-3 text-sm before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-zinc-900/[0.06] first:before:hidden';

function RepeatedInvoices({ rows }: { rows: NonNullable<Check['repeated']> }) {
  if (rows.length === 0) return null;
  return (
    <AlertList
      tone="orange"
      title="FRs talvez repetidas"
      hint="Mesmo cliente e mesmo valor com poucos dias de diferença. Pode estar certo, por exemplo duas pessoas na mesma reserva. Confirme na FACT.pt."
      count={rows.length}
    >
      {rows.map(row => (
        <div key={row.invoiceRefs.join()} className={ALERT_ROW}>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-zinc-900">{row.invoiceRefs.join(' e ')}</span>
            <span className="text-[12.5px] text-zinc-400">{row.client || 'Cliente da FACT.pt'} · {formatDay(row.date, true)}</span>
          </span>
          <span className="shrink-0 text-[14px] font-semibold tabular-nums text-zinc-900">{formatEur(row.amount)}</span>
        </div>
      ))}
    </AlertList>
  );
}

function MoneyCheck({ check }: { check: Check }) {
  if (check.checked === 0) return null;

  if (check.missing.length === 0) {
    return (
      <p className="flex items-center gap-2 px-1 text-[12.5px] text-zinc-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
        {check.checked} pagamentos por transferência conferidos com o banco
        {check.waiting > 0 ? ` · ${check.waiting} ainda dentro do prazo` : ''}
      </p>
    );
  }

  return (
    <AlertList
      tone="rose"
      title="Pagos no site, sem dinheiro no banco"
      hint="Pagamentos por transferência sem movimento com este valor há mais de 7 dias. Confirme se o registo está certo."
      count={check.missing.length}
    >
      {check.missing.map(payment => (
        <Link key={payment.id} href={payment.href} className={`${ALERT_ROW} transition-colors duration-150 hover:bg-zinc-900/[0.025]`}>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-zinc-900">{payment.label}</span>
            <span className="text-[12.5px] text-zinc-400">Registado a {formatDay(payment.paidOn, true)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[14px] font-semibold tabular-nums text-zinc-900">
            {formatEur(payment.amount)}
            <ArrowUpRight className="h-4 w-4 text-zinc-300 transition-colors duration-150 group-hover:text-zinc-500" aria-hidden />
          </span>
        </Link>
      ))}
    </AlertList>
  );
}
