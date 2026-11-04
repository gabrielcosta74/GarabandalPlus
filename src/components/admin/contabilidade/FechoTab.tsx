"use client";

import { useMemo } from 'react';
import { ArrowRight, Check, FileSpreadsheet, Lock } from 'lucide-react';

import { formatEur, formatPeriod } from '../../../lib/ledger/format';
import { monthBalances } from './MovimentosTab';
import type { LedgerMovement } from './types';
import { Button, Card, EmptyState, cx, isOpen, missingDocument, missingInvoice } from './ui';

type CheckItem = {
  key: string;
  label: string;
  state: 'ok' | 'fail' | 'pending';
  detail: string;
  goTo?: 'por-tratar' | 'movimentos';
};

export default function FechoTab({
  period,
  movements,
  readOnlyReason,
  closedBy,
  onGo,
}: {
  period: string | null;
  movements: LedgerMovement[];
  readOnlyReason: string | null;
  closedBy: { closed_by: string; closed_at: string } | null;
  onGo: (tab: 'por-tratar' | 'movimentos') => void;
}) {
  const checks = useMemo<CheckItem[]>(() => {
    const open = movements.filter(isOpen).length;
    const noInvoice = movements.filter(missingInvoice).length;
    const noDocument = movements.filter(missingDocument).length;
    const balances = monthBalances(movements);
    return [
      { key: 'open', label: 'Todos os movimentos confirmados', state: open ? 'fail' : 'ok', detail: open ? `${open} ainda por tratar` : 'Nenhum por tratar', goTo: 'por-tratar' },
      { key: 'invoice', label: 'Entradas com fatura-recibo', state: noInvoice ? 'fail' : 'ok', detail: noInvoice ? `${noInvoice} sem fatura` : 'Todas as doações, quotas e vendas têm FR', goTo: 'movimentos' },
      { key: 'document', label: 'Despesas com documento', state: noDocument ? 'fail' : 'ok', detail: noDocument ? `${noDocument} sem documento` : 'Todas têm fatura anexada ou em papel', goTo: 'movimentos' },
      {
        key: 'balance',
        label: 'Saldo igual ao do banco',
        state: !balances ? 'pending' : balances.matches ? 'ok' : 'fail',
        detail: !balances ? 'Sem saldos no extrato' : balances.matches ? `Saldo final ${formatEur(balances.closing)}` : `As contas dão ${formatEur(balances.computed)}`,
        goTo: 'movimentos',
      },
      { key: 'factpt', label: 'Totais iguais aos da FACT.pt', state: 'pending', detail: 'Comparação automática — em breve' },
    ];
  }, [movements]);

  if (!period || movements.length === 0) {
    return <Card><EmptyState title="Sem movimentos para fechar" /></Card>;
  }

  const required = checks.filter(c => c.state !== 'pending');
  const passed = required.filter(c => c.state === 'ok').length;
  const ready = checks.every(check => check.state === 'ok');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-5 px-6 py-6">
          <Ring value={passed} total={required.length} />
          <div>
            <p className="text-sm text-zinc-500">{formatPeriod(period)}</p>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
              {closedBy ? 'Mês fechado' : ready ? 'Verificações concluídas' : 'Fecho por preparar'}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {closedBy
                ? `Fechado por ${closedBy.closed_by} a ${closedBy.closed_at.slice(0, 10)}.`
                : ready
                  ? 'As verificações estão concluídas. O fecho e a exportação ainda estão em desenvolvimento.'
                  : `${required.length - passed} verificações por resolver; ${checks.length - required.length} ainda sem automatização.`}
            </p>
          </div>
        </div>
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
          {checks.map(check => (
            <li key={check.key} className="flex items-center gap-4 px-6 py-4">
              <span
                className={cx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  check.state === 'ok' && 'bg-emerald-500 text-white',
                  check.state === 'fail' && 'bg-white text-zinc-300 ring-2 ring-inset ring-zinc-200',
                  check.state === 'pending' && 'bg-zinc-100 text-zinc-300',
                )}
                aria-hidden
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx('text-sm font-medium', check.state === 'pending' ? 'text-zinc-400' : 'text-zinc-900')}>{check.label}</p>
                <p className={cx('text-[13px]', check.state === 'fail' ? 'text-orange-600' : 'text-zinc-500')}>{check.detail}</p>
              </div>
              {check.state === 'fail' && check.goTo && (
                <Button size="sm" onClick={() => onGo(check.goTo!)}>
                  Resolver <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex h-fit flex-col gap-4 p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white" aria-hidden>
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-[15px] font-semibold text-zinc-900">Enviar ao contabilista</h3>
          <p className="mt-1 text-sm text-zinc-500">
            O fecho e o Excel para a Factor M ainda não estão disponíveis. Os movimentos continuam editáveis.
          </p>
        </div>
        <Button
          variant="dark"
          size="lg"
          disabled
          title={readOnlyReason || 'O fecho do mês e a exportação ainda estão em desenvolvimento.'}
        >
          <Lock className="h-4 w-4" aria-hidden />
          Fechar mês e gerar Excel
        </Button>
        <p className="text-center text-xs text-zinc-400">Ainda indisponível</p>
      </Card>
    </div>
  );
}

function Ring({ value, total }: { value: number; total: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const share = total ? value / total : 0;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#f4f4f5" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${share * circumference} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-zinc-900">
        {value}/{total}
      </span>
    </div>
  );
}
