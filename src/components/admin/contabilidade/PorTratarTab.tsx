"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Camera, CheckCheck, FileCheck2, Link2, FileWarning, HandCoins, HelpCircle, PartyPopper, type LucideIcon } from 'lucide-react';

import { inboxGroup, type InboxGroup } from '../../../lib/ledger/categories';
import MovementRow from './MovementRow';
import type { LedgerMovement } from './types';
import { Button, Card, EmptyState, cx, isOpen, missingDocument } from './ui';

const VISIBLE_PER_GROUP = 6;

type Section = InboxGroup | 'linked' | 'manual';

const SECTIONS: { key: Section; title: string; hint: string; icon: LucideIcon; tile: string }[] = [
  {
    key: 'linked',
    title: 'Já ligadas a uma fatura da app',
    hint: 'Transferências que o sistema reconheceu com certeza (mesmo valor e mesmo nome). A FR já foi emitida; só falta confirmar.',
    icon: Link2,
    tile: 'bg-emerald-50 text-emerald-600',
  },
  {
    key: 'manual',
    title: 'FR encontrada na FACT.pt',
    hint: 'Entradas com uma fatura-recibo emitida à mão, com o mesmo valor e o mesmo nome. Só falta confirmar; nada é emitido.',
    icon: FileCheck2,
    tile: 'bg-emerald-50 text-emerald-600',
  },
  {
    key: 'income',
    title: 'Entradas para confirmar',
    hint: 'Transferências sem FR encontrada. Abra cada uma, diga o que é e emita a fatura.',
    icon: HandCoins,
    tile: 'bg-rose-50 text-rose-600',
  },
  {
    key: 'review',
    title: 'Precisam de uma decisão',
    hint: 'O sistema não tem a certeza do que são.',
    icon: HelpCircle,
    tile: 'bg-sky-50 text-sky-600',
  },
  {
    key: 'document',
    title: 'Despesas sem documento',
    hint: 'Abra cada uma e anexe a fatura, ou marque que está em papel. O mês só fecha com todas justificadas.',
    icon: FileWarning,
    tile: 'bg-orange-50 text-orange-600',
  },
  {
    key: 'safe',
    title: 'Prontas a aprovar',
    hint: 'Comissões, imposto do selo e liquidações. Reconhecidas com certeza; não emitem faturas.',
    icon: CheckCheck,
    tile: 'bg-emerald-50 text-emerald-600',
  },
];

export function groupFor(movement: LedgerMovement): Section {
  if (movement.linkedPaymentId && movement.appInvoiceRef) return 'linked';
  if (movement.suggestion?.confidence === 'manual' && movement.suggestion.invoiceRef) return 'manual';
  return inboxGroup({
    amount: movement.amount,
    categoryCode: movement.categoryCode,
    suggestedCategoryCode: movement.suggestedCategoryCode,
    needsDocument: movement.needsDocument,
    hasDocument: movement.documentCount > 0 || movement.paperDocument,
  });
}

export default function PorTratarTab({
  movements,
  selectedId,
  readOnlyReason,
  onOpen,
  onApprove,
  onQuickCapture,
}: {
  movements: LedgerMovement[];
  selectedId: string | null;
  readOnlyReason: string | null;
  onOpen: (movement: LedgerMovement) => void;
  onApprove: (rows: LedgerMovement[]) => void;
  /** Opens the one-at-a-time photo mode for expenses missing their invoice. */
  onQuickCapture?: () => void;
}) {
  // An approved expense without its invoice is still work to do.
  const open = useMemo(() => movements.filter(movement => isOpen(movement) || missingDocument(movement)), [movements]);
  const grouped = useMemo(() => {
    const map = new Map<Section, LedgerMovement[]>(SECTIONS.map(s => [s.key, []]));
    open.forEach(m => map.get(groupFor(m))!.push(m));
    return map;
  }, [open]);
  const [expanded, setExpanded] = useState<Set<Section>>(new Set());

  if (movements.length === 0) {
    return (
      <Card>
        <EmptyState title="Ainda não há movimentos">Assim que a ligação ao banco estiver ativa, os movimentos aparecem aqui todos os dias.</EmptyState>
      </Card>
    );
  }

  if (open.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><PartyPopper className="h-6 w-6" /></span>}
          title="Está tudo tratado"
        >
          Todos os movimentos deste mês estão confirmados. Pode avançar para o fecho do mês.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {SECTIONS.map(section => {
        const rows = grouped.get(section.key) || [];
        if (rows.length === 0) return null;
        const visible = expanded.has(section.key) ? rows : rows.slice(0, VISIBLE_PER_GROUP);
        const Icon = section.icon;
        return (
          <Card key={section.key} className="overflow-hidden">
            <header className="flex flex-col gap-3 px-5 pb-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', section.tile)} aria-hidden>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
                    {section.title}
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600">{rows.length}</span>
                  </h2>
                  <p className="mt-0.5 text-[13px] text-zinc-500">{section.hint}</p>
                </div>
              </div>
              {section.key === 'document' && onQuickCapture && (
                <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" onClick={onQuickCapture}>
                  <Camera className="h-4 w-4" aria-hidden />
                  Fotografar faturas
                </Button>
              )}
              {(section.key === 'safe' || section.key === 'linked' || section.key === 'manual') && (
                <Button
                  variant="primary"
                  size="sm"
                  className="shrink-0 whitespace-nowrap"
                  disabled={!!readOnlyReason}
                  title={readOnlyReason || undefined}
                  onClick={() => onApprove(rows)}
                >
                  <CheckCheck className="h-4 w-4" aria-hidden />
                  Aprovar todas ({rows.length})
                </Button>
              )}
            </header>
            <div className="divide-y divide-zinc-100 border-t border-zinc-100">
              <AnimatePresence initial={false}>
              {visible.map(m => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
                  className="overflow-hidden"
                >
                <MovementRow
                  key={m.id}
                  movement={m}
                  onOpen={onOpen}
                  active={m.id === selectedId}
                  action={section.key === 'safe' || section.key === 'linked' || section.key === 'manual' ? (
                    <Button
                      size="sm"
                      disabled={!!readOnlyReason}
                      onClick={event => { event.stopPropagation(); onApprove([m]); }}
                    >
                      Aprovar
                    </Button>
                  ) : undefined}
                />
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
            {rows.length > VISIBLE_PER_GROUP && (
              <button
                type="button"
                onClick={() => setExpanded(prev => {
                  const next = new Set(prev);
                  if (next.has(section.key)) next.delete(section.key); else next.add(section.key);
                  return next;
                })}
                className="w-full border-t border-zinc-100 px-5 py-3 text-center text-[13px] font-medium text-zinc-500 transition-colors duration-200 hover:bg-zinc-50 hover:text-zinc-900"
              >
                {expanded.has(section.key) ? 'Mostrar menos' : `Mostrar mais ${rows.length - VISIBLE_PER_GROUP}`}
              </button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
