"use client";

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronDown, Files, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';

import { formatDay, formatEur } from '../../../lib/ledger/format';
import { adminFetch } from './useLedger';
import { Card, Hint, SPRING } from './ui';

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
  const repeated = check.repeated || [];
  const [open, setOpen] = useState(false);
  const issues = repeated.length + check.missing.length;

  if (issues === 0) {
    if (check.checked === 0) return null;
    return (
      <p className="flex items-center gap-2 px-1 text-[13px] text-zinc-500">
        <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
        {check.checked} pagamentos por transferência conferidos com o banco
        {check.waiting > 0 ? ` · ${check.waiting} ainda dentro do prazo` : ''}
      </p>
    );
  }

  const parts = [
    check.missing.length ? `${check.missing.length} ${check.missing.length === 1 ? 'pago' : 'pagos'} no site sem dinheiro no banco` : null,
    repeated.length ? `${repeated.length} ${repeated.length === 1 ? 'FR talvez repetida' : 'FRs talvez repetidas'}` : null,
  ].filter(Boolean);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left outline-none transition-colors duration-150 hover:bg-zinc-900/[0.03] focus-visible:bg-zinc-900/[0.04]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/[0.14] text-orange-500" aria-hidden>
          <TriangleAlert className="h-[17px] w-[17px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-[-0.01em] text-zinc-900">{issues === 1 ? '1 coisa a verificar' : `${issues} coisas a verificar`}</span>
          <span className="block truncate text-[13.5px] text-zinc-500">{parts.join(' · ')}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[13.5px] font-medium text-zinc-500">
          {open ? 'Esconder' : 'Ver'}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 border-t border-zinc-900/[0.07] px-2 pb-3 pt-4">
              <MoneyCheck check={check} />
              <RepeatedInvoices rows={repeated} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function Group({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 px-3 text-[13.5px] font-semibold text-zinc-700">
        <span className="text-zinc-500" aria-hidden>{icon}</span>
        {title}
        <Hint>{hint}</Hint>
      </h3>
      <div>{children}</div>
    </section>
  );
}

const ALERT_ROW = 'group flex items-center justify-between gap-4 rounded-[14px] px-3 py-2.5 transition-colors duration-150 hover:bg-zinc-900/[0.04]';

function RepeatedInvoices({ rows }: { rows: NonNullable<Check['repeated']> }) {
  if (rows.length === 0) return null;
  return (
    <Group
      icon={<Files className="h-4 w-4" />}
      title="FRs talvez repetidas"
      hint="Mesmo cliente e mesmo valor com poucos dias de diferença. Pode estar certo, por exemplo duas pessoas na mesma reserva. Confirme na FACT.pt."
    >
      {rows.map(row => (
        <div key={row.invoiceRefs.join()} className={ALERT_ROW}>
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-medium text-zinc-900">{row.invoiceRefs.join(' · ')}</span>
            <span className="block truncate text-[13px] text-zinc-500">{row.client || 'Cliente da FACT.pt'} · {formatDay(row.date, true)}</span>
          </span>
          <span className="shrink-0 text-[14.5px] font-semibold tabular-nums text-zinc-900">{formatEur(row.amount)}</span>
        </div>
      ))}
    </Group>
  );
}

function MoneyCheck({ check }: { check: Check }) {
  if (check.missing.length === 0) return null;
  return (
    <Group
      icon={<ShieldAlert className="h-4 w-4" />}
      title="Pagos no site, sem dinheiro no banco"
      hint="Pagamentos por transferência sem movimento com este valor há mais de 7 dias. Confirme se o registo está certo."
    >
      {check.missing.map(payment => (
        <Link key={payment.id} href={payment.href} className={ALERT_ROW}>
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-medium text-zinc-900">{payment.label}</span>
            <span className="block truncate text-[13px] text-zinc-500">Registado a {formatDay(payment.paidOn, true)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[14.5px] font-semibold tabular-nums text-zinc-900">
            {formatEur(payment.amount)}
            <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-colors duration-150 group-hover:text-zinc-700" aria-hidden />
          </span>
        </Link>
      ))}
    </Group>
  );
}
