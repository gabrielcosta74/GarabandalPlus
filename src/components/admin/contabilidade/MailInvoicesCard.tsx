"use client";

import { useEffect, useState } from 'react';
import { FileText, Inbox } from 'lucide-react';

import { formatDay } from '../../../lib/ledger/format';
import { adminFetch } from './useLedger';
import { Card, cx } from './ui';

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

/**
 * Faturas de fornecedores que chegaram à caixa geral@ e ainda não estão num
 * movimento. Quando o débito entra no banco, saem daqui e passam para o movimento.
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

  if (!invoices?.length) return null;
  const waiting = invoices.filter(invoice => invoice.status === 'waiting');
  const outside = invoices.filter(invoice => invoice.status === 'outside');
  const rows = showOutside ? [...waiting, ...outside] : waiting;
  if (!waiting.length && !outside.length) return null;

  return (
    <Card className="overflow-hidden">
      <header className="flex items-start gap-3 px-5 pb-3 pt-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600" aria-hidden>
          <Inbox className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
            Faturas recebidas por email
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600">{waiting.length}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Subscrições (Railway, Resend, Supabase, Mobbin, Vodafone, Tranquilidade) que chegaram à caixa geral@. Ficam aqui até o débito entrar no banco e depois passam sozinhas para o movimento.
          </p>
        </div>
      </header>
      {rows.length > 0 && (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
          {rows.map(invoice => (
            <li key={invoice.id} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900">
                  {invoice.supplier} <span className="font-normal text-zinc-500">· {invoice.docNumber}</span>
                </p>
                <p className={cx('text-xs', invoice.note ? 'text-orange-700' : 'text-zinc-500')}>
                  Paga a {formatDay(invoice.paidOn, true)}
                  {money(invoice.amount, invoice.currency) ? ` · ${money(invoice.amount, invoice.currency)}` : ''}
                  {invoice.status === 'outside' ? ' · anterior à ligação ao banco' : invoice.note ? ` · ${invoice.note}` : ' · à espera do débito'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {invoice.files.map(file => file.url ? (
                  <a key={file.fileName} href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900">
                    <FileText className="h-3.5 w-3.5" aria-hidden /> {file.kind === 'invoice' ? 'Fatura' : file.kind === 'receipt' ? 'Recibo' : 'Detalhe'}
                  </a>
                ) : null)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {outside.length > 0 && (
        <button
          type="button"
          onClick={() => setShowOutside(value => !value)}
          className="w-full border-t border-zinc-100 px-5 py-3 text-center text-[13px] font-medium text-zinc-500 transition-colors duration-200 hover:bg-zinc-50 hover:text-zinc-900"
        >
          {showOutside ? 'Esconder as anteriores ao banco' : `Mostrar ${outside.length} anterior(es) à ligação ao banco`}
        </button>
      )}
    </Card>
  );
}
