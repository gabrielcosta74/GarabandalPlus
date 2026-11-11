"use client";

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

import type { QuoteRow } from '../../../../../../lib/logistics-accounts';
import type { hotelApi } from './api';
import type { Notify } from './HotelsBoard';
import { Button, InlineInput, SPRING, Segmented, cx, parseAmount } from './primitives';

/** Orçamentos de outros hotéis, para comparar antes de fechar. Não entram nas contas. */
export default function QuotesPanel({
    quotes, api, onChanged, notify,
}: {
    quotes: QuoteRow[];
    api: ReturnType<typeof hotelApi>;
    onChanged: () => Promise<void> | void;
    notify: Notify;
}) {
    const [open, setOpen] = useState(false);
    const run = async (work: () => Promise<unknown>) => {
        try { await work(); await onChanged(); } catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível gravar.', 'error'); }
    };
    const money = (quote: QuoteRow, key: string) => (value: string) => {
        const n = parseAmount(value);
        if (n !== null) void run(() => api.patchQuote(quote.id, { [key]: n }));
    };

    return (
        <section className="hg-glass rounded-[28px] p-4 md:p-5">
            <button type="button" onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-3 px-1 text-left">
                <span>
                    <span className="block text-[15px] font-semibold text-zinc-900">Alternativas <span className="font-normal text-zinc-400">· {quotes.length}</span></span>
                    <span className="block text-[12.5px] text-zinc-500">Orçamentos de outros hotéis. Não contam nas contas.</span>
                </span>
                <ChevronDown className={cx('h-4 w-4 text-zinc-400 transition-transform duration-200', open && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
                        <div className="mt-4 space-y-2">
                            {quotes.map(quote => (
                                <div key={quote.id} className={cx('hg-well grid grid-cols-2 items-center gap-1 rounded-2xl p-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_120px_auto_36px]', quote.status === 'rejected' && 'opacity-50')}>
                                    <InlineInput value={quote.hotel} placeholder="Hotel" onCommit={hotel => void run(() => api.patchQuote(quote.id, { hotel }))} />
                                    <InlineInput value={quote.city} placeholder="Cidade" onCommit={city => void run(() => api.patchQuote(quote.id, { city }))} />
                                    <InlineInput kind="number" align="right" suffix="€" value={quote.sharedPricePerPerson} ariaLabel="Partilhado por pessoa" onCommit={money(quote, 'shared_price_per_person')} />
                                    <InlineInput kind="number" align="right" suffix="€" value={quote.singlePricePerPerson} ariaLabel="Individual por pessoa" onCommit={money(quote, 'single_price_per_person')} />
                                    <Segmented size="sm" value={quote.status} onChange={status => void run(() => api.patchQuote(quote.id, { status }))}
                                        options={[{ value: 'shortlist', label: 'Em estudo' }, { value: 'chosen', label: 'Escolhido' }, { value: 'rejected', label: 'De lado' }]} />
                                    <button type="button" aria-label="Apagar orçamento" onClick={() => void run(() => api.deleteQuote(quote.id))}
                                        className="flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-zinc-300 hover:bg-rose-500/10 hover:text-rose-600">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                            <p className="px-1 text-[12px] text-zinc-400">Preços por pessoa: partilhado · individual.</p>
                            <Button onClick={() => void run(() => api.addQuote({ city: '', hotel: '', board: 'Meia pensão', status: 'shortlist', display_order: quotes.length + 1 }))} className="h-8 text-[12.5px]">
                                <Plus className="h-3.5 w-3.5" /> Orçamento
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
