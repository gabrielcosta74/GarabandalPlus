"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Camera, CheckCheck, Check } from 'lucide-react';

import { inboxGroup, type InboxGroup } from '../../../lib/ledger/categories';
import MovementRow from './MovementRow';
import type { LedgerMovement } from './types';
import { Button, Card, Count, EmptyState, Hint, SPRING, isOpen, missingDocument } from './ui';

const VISIBLE_PER_GROUP = 6;

type Section = InboxGroup | 'linked' | 'manual';

/** In the order the admin should work through them: quick approvals first. */
const SECTIONS: { key: Section; title: string; hint: string; dot: string }[] = [
  {
    key: 'linked',
    title: 'Ligadas a uma FR da app',
    hint: 'Transferências reconhecidas com certeza (mesmo valor e mesmo nome). A FR já foi emitida; só falta confirmar.',
    dot: 'bg-emerald-500',
  },
  {
    key: 'manual',
    title: 'FR encontrada na FACT.pt',
    hint: 'Entradas com uma fatura-recibo emitida à mão, com o mesmo valor e o mesmo nome. Só falta confirmar; nada é emitido.',
    dot: 'bg-emerald-500',
  },
  {
    key: 'safe',
    title: 'Prontas a aprovar',
    hint: 'Comissões, imposto do selo e liquidações. Reconhecidas com certeza; não emitem faturas.',
    dot: 'bg-emerald-500',
  },
  {
    key: 'income',
    title: 'Entradas para confirmar',
    hint: 'Transferências sem FR encontrada. Abra cada uma, diga o que é e emita a fatura.',
    dot: 'bg-rose-500',
  },
  {
    key: 'review',
    title: 'Precisam de uma decisão',
    hint: 'O sistema não tem a certeza do que são.',
    dot: 'bg-sky-500',
  },
  {
    key: 'document',
    title: 'Despesas sem documento',
    hint: 'Abra cada uma e anexe a fatura, ou marque que está em papel. O mês só fecha com todas justificadas.',
    dot: 'bg-orange-500',
  },
];

const APPROVABLE: Section[] = ['safe', 'linked', 'manual'];

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
        <EmptyState title="Ainda não há movimentos">Aparecem aqui assim que o banco os enviar.</EmptyState>
      </Card>
    );
  }

  if (open.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={(
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
            >
              <Check className="h-7 w-7" strokeWidth={3} />
            </motion.span>
          )}
          title="Está tudo tratado"
        >
          Pode avançar para o fecho do mês.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {SECTIONS.map(section => {
        const rows = grouped.get(section.key) || [];
        if (rows.length === 0) return null;
        const visible = expanded.has(section.key) ? rows : rows.slice(0, VISIBLE_PER_GROUP);
        const approvable = APPROVABLE.includes(section.key);
        return (
          <section key={section.key} aria-label={section.title}>
            <header className="mb-2.5 flex min-h-8 items-center justify-between gap-3 px-1">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">
                {section.title}
                <Count value={rows.length} />
                <Hint>{section.hint}</Hint>
              </h2>
              {section.key === 'document' && onQuickCapture && (
                <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={onQuickCapture}>
                  <Camera className="h-3.5 w-3.5" aria-hidden />
                  Fotografar faturas
                </Button>
              )}
              {approvable && (
                <Button
                  variant="primary"
                  size="sm"
                  className="shrink-0 whitespace-nowrap"
                  disabled={!!readOnlyReason}
                  title={readOnlyReason || undefined}
                  onClick={() => onApprove(rows)}
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                  {rows.length > 1 ? `Aprovar todas` : 'Aprovar'}
                </Button>
              )}
            </header>
            <Card className="overflow-hidden">
              <AnimatePresence initial={false}>
                {visible.map(m => (
                  <motion.div
                    key={m.id}
                    layout="position"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } }}
                    transition={SPRING}
                    className="group/item overflow-hidden"
                  >
                    <MovementRow
                      movement={m}
                      onOpen={onOpen}
                      active={m.id === selectedId}
                      action={approvable ? (
                        <button
                          type="button"
                          disabled={!!readOnlyReason}
                          onClick={event => { event.stopPropagation(); onApprove([m]); }}
                          aria-label="Aprovar"
                          title="Aprovar"
                          className="lg-icon flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-zinc-900 hover:text-white active:scale-90 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                        >
                          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                        </button>
                      ) : undefined}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              {rows.length > VISIBLE_PER_GROUP && (
                <button
                  type="button"
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev);
                    if (next.has(section.key)) next.delete(section.key); else next.add(section.key);
                    return next;
                  })}
                  className="w-full border-t border-zinc-900/[0.06] px-4 py-2.5 text-center text-[13px] font-medium text-zinc-500 transition-colors duration-150 hover:bg-zinc-900/[0.02] hover:text-zinc-900"
                >
                  {expanded.has(section.key) ? 'Mostrar menos' : `Mais ${rows.length - VISIBLE_PER_GROUP}`}
                </button>
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
