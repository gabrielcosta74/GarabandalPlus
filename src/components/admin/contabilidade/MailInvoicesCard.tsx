"use client";

import { useEffect, useState } from 'react';
import { ExternalLink, Mail } from 'lucide-react';

import { formatDay } from '../../../lib/ledger/format';
import { adminFetch } from './useLedger';
import { Card, Count, Hint, cx } from './ui';

type MailInvoice = {
  id: string;
  supplier: string;
  docNumber: string;
  paidOn: string;
  amount: number | null;
  currency: string | null;
  status: 'waiting' | 'outside';
  note: string | null;
  files: { kind: 'invoice' | 'receipt' | 'detail'; fileName: string; url: string | null }[];
};

const money = (amount: number | null, currency: string | null) => {
  if (amount === null || !currency) return null;
  try {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const FILE_LABEL = { invoice: 'Fatura', receipt: 'Recibo', detail: 'Detalhe' } as const;

/**
 * Subscription invoices that reached geral@ and wait for their bank debit.
 * When the debit arrives they leave this list and join the movement's files.
 */
export default function MailInvoicesCard({ refreshKey }: { refreshKey: unknown }) {
  const [invoices, setInvoices] = useState<MailInvoice[] | null>(null);
  const [showOutside, setShowOutside] = useState(false);

  useEffect(() => {
    let active = true;
    void adminFetch('/api/admin/contabilidade/faturas-email')
      .then((result: { invoices: MailInvoice[] }) => { if (active) setInvoices(result.invoices); })
      .catch(() => { if (active) setInvoices([]); });
    return () => { active = false; };
  }, [refreshKey]);

  const waiting = (invoices || []).filter(invoice => invoice.status === 'waiting');
  const outside = (invoices || []).filter(invoice => invoice.status === 'outside');
  if (!waiting.length && !outside.length) return null;
  const rows = showOutside ? [...waiting, ...outside] : waiting;

  return (
    <section>
      <header className="mb-2.5 flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">
          À espera do banco
          <Count value={waiting.length} />
          <Hint>
            Faturas das subscrições (Railway, Resend, Supabase, Mobbin, Vodafone, Tranquilidade) que chegaram à geral@.
            Quando o débito entra no banco, passam sozinhas para o movimento.
          </Hint>
        </h2>
        {outside.length > 0 && (
          <button type="button" onClick={() => setShowOutside(value => !value)} className="text-[12.5px] font-medium text-zinc-500 transition-colors duration-150 hover:text-zinc-900">
            {showOutside ? 'Esconder anteriores' : `${outside.length} anteriores ao banco`}
          </button>
        )}
      </header>
      {rows.length > 0 && (
        <Card className="overflow-hidden">
          <ul>
            {rows.map(invoice => (
              <li key={invoice.id} className="relative flex items-center gap-3.5 px-4 py-3 before:absolute before:left-[66px] before:right-0 before:top-0 before:h-px before:bg-zinc-900/[0.06] first:before:hidden">
                <span className="lg-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600" aria-hidden>
                  <Mail className="h-[15px] w-[15px]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium tracking-[-0.01em] text-zinc-900">{invoice.supplier}</p>
                  <p className={cx('truncate text-[12.5px]', invoice.note && invoice.status === 'waiting' ? 'text-orange-600' : 'text-zinc-400')}>
                    {formatDay(invoice.paidOn, true)} · {invoice.docNumber}
                    {invoice.status === 'outside' ? ' · antes da ligação ao banco' : invoice.note ? ` · ${invoice.note}` : ''}
                  </p>
                </div>
                {money(invoice.amount, invoice.currency) && (
                  <span className="hidden shrink-0 text-[13px] tabular-nums text-zinc-500 sm:inline">{money(invoice.amount, invoice.currency)}</span>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {invoice.files.map(file => file.url ? (
                    <a
                      key={file.fileName}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lg-pill inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-zinc-600 transition-colors duration-150 hover:text-zinc-900"
                    >
                      {FILE_LABEL[file.kind]} <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : null)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
