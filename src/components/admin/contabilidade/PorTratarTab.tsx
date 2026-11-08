"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { Camera, Check, CheckCheck, ChevronDown } from 'lucide-react';

import { inboxGroup, type InboxGroup } from '../../../lib/ledger/categories';
import MovementRow from './MovementRow';
import type { LedgerMovement } from './types';
import { Button, Card, EmptyState, Hint, SPRING, cx, isOpen, missingDocument } from './ui';

const VISIBLE_PER_GROUP = 5;

/** Fine-grained group a movement falls in. */
type Section = InboxGroup | 'linked' | 'manual';

/** What the admin has to *do*: four jobs, in the order they are quickest to clear. */
type Job = 'approve' | 'income' | 'review' | 'document';

const JOBS: { key: Job; chip: string; title: string; hint: string; sections: Section[] }[] = [
  {
    key: 'approve',
    chip: 'Aprovar',
    title: 'Prontas a aprovar',
    hint: 'Reconhecidas com certeza: FR da app ou da FACT.pt com o mesmo nome e valor, comissões, imposto do selo e liquidações. Aprovar não emite nada.',
    sections: ['linked', 'manual', 'safe'],
  },
  {
    key: 'income',
    chip: 'Confirmar',
    title: 'Entradas para confirmar',
    hint: 'Transferências sem FR encontrada. Abra cada uma, diga o que é e emita a fatura.',
    sections: ['income'],
  },
  {
    key: 'review',
    chip: 'Decidir',
    title: 'Precisam de uma decisão',
    hint: 'O sistema não tem a certeza do que são.',
    sections: ['review'],
  },
  {
    key: 'document',
    chip: 'Documentos',
    title: 'Despesas sem documento',
    hint: 'Anexe a fatura ou marque que está em papel. O mês só fecha com todas justificadas.',
    sections: ['document'],
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

function jobFor(movement: LedgerMovement): Job {
  const section = groupFor(movement);
  return JOBS.find(job => job.sections.includes(section))!.key;
}

function toggled<T>(set: Set<T>, key: T): Set<T> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

export default function PorTratarTab({
  movements,
  selectedId,
  readOnlyReason,
  onOpen,
  onApprove,
  onQuickCapture,
  aside,
  notices,
}: {
  movements: LedgerMovement[];
  selectedId: string | null;
  readOnlyReason: string | null;
  onOpen: (movement: LedgerMovement) => void;
  onApprove: (rows: LedgerMovement[]) => void;
  /** Opens the one-at-a-time photo mode for expenses missing their invoice. */
  onQuickCapture?: () => void;
  /** Right of the filter row (other months). */
  aside?: ReactNode;
  /** Under the filter row (bank checks). */
  notices?: ReactNode;
}) {
  // An approved expense without its invoice is still work to do.
  const open = useMemo(() => movements.filter(movement => isOpen(movement) || missingDocument(movement)), [movements]);
  const grouped = useMemo(() => {
    const map = new Map<Job, LedgerMovement[]>(JOBS.map(job => [job.key, []]));
    open.forEach(m => map.get(jobFor(m))!.push(m));
    return map;
  }, [open]);
  const [focus, setFocus] = useState<Job | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<Job>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<Job>>(new Set());

  if (movements.length === 0) {
    return (
      <Card>
        <EmptyState title="Ainda não há movimentos">Aparecem aqui assim que o banco os enviar.</EmptyState>
      </Card>
    );
  }

  const present = JOBS.filter(job => (grouped.get(job.key) || []).length > 0);
  // If the focused job was emptied (all approved), fall back to everything.
  const activeFocus = focus !== 'all' && present.some(job => job.key === focus) ? focus : 'all';
  const shown = activeFocus === 'all' ? present : present.filter(job => job.key === activeFocus);

  return (
    <div className="flex flex-col gap-6">
      {(present.length > 1 || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {present.length > 1 ? (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por tarefa">
              <Chip active={activeFocus === 'all'} onClick={() => setFocus('all')} label="Tudo" count={open.length} />
              {present.map(job => (
                <Chip key={job.key} active={activeFocus === job.key} onClick={() => setFocus(job.key)} label={job.chip} count={grouped.get(job.key)!.length} />
              ))}
            </div>
          ) : <span />}
          {aside}
        </div>
      )}

      {notices}

      {open.length === 0 ? (
        <Card>
          <EmptyState
            icon={(
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-black/30"
              >
                <Check className="h-7 w-7" strokeWidth={3} />
              </motion.span>
            )}
            title="Está tudo tratado"
          >
            Pode avançar para o fecho do mês.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-9">
          {shown.map(job => {
            const rows = grouped.get(job.key) || [];
            const focused = activeFocus === job.key;
            const isCollapsed = collapsed.has(job.key) && !focused;
            const visible = focused || expanded.has(job.key) ? rows : rows.slice(0, VISIBLE_PER_GROUP);
            const approvable = job.key === 'approve';
            return (
              <section key={job.key} aria-label={job.title}>
                <header className="mb-3 flex min-h-9 items-center justify-between gap-3 pl-1">
                  <button
                    type="button"
                    onClick={() => setCollapsed(prev => toggled(prev, job.key))}
                    aria-expanded={!isCollapsed}
                    className="group flex items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-zinc-900/15"
                  >
                    <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-zinc-900">{job.title}</h2>
                    <span className="text-[15px] font-medium tabular-nums text-zinc-400">{rows.length}</span>
                    <ChevronDown className={cx('h-4 w-4 text-zinc-400 transition-transform duration-200 group-hover:text-zinc-600', isCollapsed && '-rotate-90')} aria-hidden />
                  </button>
                  <div className="flex items-center gap-2">
                    <Hint align="right">{job.hint}</Hint>
                    {job.key === 'document' && onQuickCapture && (
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
                        {rows.length > 1 ? `Aprovar ${rows.length}` : 'Aprovar'}
                      </Button>
                    )}
                  </div>
                </header>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      key="list"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={SPRING}
                      className="-m-6 overflow-hidden p-6"
                    >
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
                                    className="lg-icon flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-zinc-900 hover:text-white active:scale-90 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                                  >
                                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                                  </button>
                                ) : undefined}
                              />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {!focused && rows.length > VISIBLE_PER_GROUP && (
                          <button
                            type="button"
                            onClick={() => setExpanded(prev => toggled(prev, job.key))}
                            className="w-full border-t border-zinc-900/[0.06] px-4 py-3 text-center text-[13.5px] font-medium text-zinc-500 transition-colors duration-150 hover:bg-zinc-900/[0.03] hover:text-zinc-900"
                          >
                            {expanded.has(job.key) ? 'Mostrar menos' : `Ver mais ${rows.length - VISIBLE_PER_GROUP}`}
                          </button>
                        )}
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-medium outline-none transition-[color,transform] duration-150 ease-out active:scale-95 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15',
        active ? 'lg-thumb text-zinc-950' : 'lg-pill text-zinc-500 hover:text-zinc-900',
      )}
    >
      {label}
      <span className={cx('tabular-nums', active ? 'text-zinc-600' : 'text-zinc-400')}>{count}</span>
    </button>
  );
}
