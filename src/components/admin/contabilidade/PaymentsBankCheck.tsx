"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Files, ShieldAlert, ShieldCheck } from 'lucide-react';

import { formatDay, formatEur } from '../../../lib/ledger/format';
import { adminFetch } from './useLedger';
import { Card } from './ui';

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

function RepeatedInvoices({ rows }: { rows: NonNullable<Check['repeated']> }) {
  if (rows.length === 0) return null;
  return (
    <Card className="mb-4 overflow-hidden">
      <header className="flex items-start gap-3 px-5 pb-3 pt-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600" aria-hidden>
          <Files className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
            FRs que podem estar repetidas
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600">{rows.length}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">Mesmo cliente e mesmo valor com poucos dias de diferença. Pode estar certo, por exemplo duas pessoas na mesma reserva. Confirme na FACT.pt.</p>
        </div>
      </header>
      <div className="divide-y divide-zinc-100 border-t border-zinc-100">
        {rows.map(row => (
          <div key={row.invoiceRefs.join()} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium text-zinc-900">{row.invoiceRefs.join(' e ')}</span>
              <span className="text-[13px] text-zinc-500">{row.client || 'Cliente da FACT.pt'} · {formatDay(row.date, true)}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-zinc-900">{formatEur(row.amount)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MoneyCheck({ check }: { check: Check }) {
  if (check.checked === 0) return null;

  if (check.missing.length === 0) {
    return (
      <p className="mb-4 flex items-center gap-2 px-1 text-[13px] text-zinc-500">
        <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
        {check.checked} pagamentos por transferência conferidos com o banco
        {check.waiting > 0 ? ` · ${check.waiting} ainda dentro do prazo` : ''}
      </p>
    );
  }

  return (
    <Card className="mb-4 overflow-hidden">
      <header className="flex items-start gap-3 px-5 pb-3 pt-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600" aria-hidden>
          <ShieldAlert className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
            Marcados como pagos, sem dinheiro no banco
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600">{check.missing.length}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">Pagamentos por transferência sem movimento com este valor há mais de 7 dias. Confirme se o registo está certo.</p>
        </div>
      </header>
      <div className="divide-y divide-zinc-100 border-t border-zinc-100">
        {check.missing.map(payment => (
          <Link key={payment.id} href={payment.href} className="group flex items-center justify-between gap-4 px-5 py-3 text-sm transition-colors duration-200 hover:bg-zinc-50">
            <span className="min-w-0">
              <span className="block truncate font-medium text-zinc-900">{payment.label}</span>
              <span className="text-[13px] text-zinc-500">Registado a {formatDay(payment.paidOn, true)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 font-medium tabular-nums text-zinc-900">
              {formatEur(payment.amount)}
              <ArrowUpRight className="h-4 w-4 text-zinc-300 transition-colors duration-200 group-hover:text-zinc-600" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
