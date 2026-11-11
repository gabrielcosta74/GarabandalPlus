"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    ArrowUpRight, CalendarClock, Check, ChevronDown, FileText, Landmark, Mail, Merge, Phone, Plus, Trash2, Upload, X,
} from 'lucide-react';

import { BOARD_OPTIONS, nightsBetween } from '../../../../../../lib/logistics-accounts';
import { lineTotal, linesSummary, splitInstallments, type HotelLine, type HotelLineKind } from '../../../../../../lib/logistics/hotel-rules';
import { shrinkPhoto } from '../../../../../../components/admin/contabilidade/compress-image';
import { agreementApi, type AgreementDetail, type PaymentCandidateView, type hotelApi } from './api';
import type { Notify } from './HotelsBoard';
import { STATUS_STEPS, type HotelView } from './model';
import { Button, Chip, InlineInput, SPRING, Segmented, cx, day, eur, parseAmount, range } from './primitives';

/** De onde se abriu o hotel. Escolhe o passo que fica aberto. */
export type SheetTab = 'conta' | 'pagamentos' | 'acordo' | 'detalhes';
type Api = ReturnType<typeof hotelApi>;
type Run = (work: () => Promise<unknown>, done?: string) => Promise<boolean>;

type Props = {
    view: HotelView;
    next: HotelView | null;
    tab: SheetTab;
    onTab: (tab: SheetTab) => void;
    pilgrimageId: string;
    api: Api;
    onChanged: () => Promise<void> | void;
    notify: Notify;
    onClose: () => void;
    roomMix: { shared: number; single: number };
};

type StepKey = 'lines' | 'proforma' | 'plan' | 'bank' | 'invoice' | 'details';

const STEP_FROM_TAB: Record<SheetTab, StepKey | null> = { conta: 'lines', acordo: 'proforma', pagamentos: null, detalhes: 'details' };

export default function HotelSheet(props: Props) {
    const { view, onClose, tab } = props;
    const { stay, cost, schedule } = view;
    const reduce = useReducedMotion();
    const [detail, setDetail] = useState<AgreementDetail | null>(null);
    const agreementId = stay.agreement?.id ?? null;

    const loadDetail = useCallback(async () => {
        if (!agreementId) { setDetail(null); return; }
        try { setDetail(await agreementApi.get(agreementId)); } catch { setDetail(null); }
    }, [agreementId]);
    useEffect(() => { void loadDetail(); }, [loadDetail, stay.paidAmount]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
    }, [onClose]);

    // Grava e devolve logo; as contas recarregam por trás, sem prender o ecrã.
    const run: Run = useCallback(async (work, done) => {
        try {
            await work();
            if (done) props.notify(done);
            void Promise.resolve(props.onChanged()).then(loadDetail);
            return true;
        } catch (error) {
            props.notify(error instanceof Error ? error.message : 'Não foi possível gravar.', 'error');
            return false;
        }
    }, [props, loadDetail]);

    // --- Linhas da conta: mudam no ecrã na hora; a gravação vai por trás ----
    const [lines, setLines] = useState<HotelLine[]>(stay.lines ?? []);
    const pending = useRef(0);
    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => { if (pending.current === 0) setLines(stay.lines ?? []); }, [stay.lines]);
    const refreshSoon = useCallback(() => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => { if (pending.current === 0) void props.onChanged(); }, 700);
    }, [props]);
    useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
    const lineOps: LineOps = useMemo(() => {
        const track = async (work: () => Promise<void>, undo: () => void) => {
            pending.current += 1;
            try { await work(); }
            catch (error) {
                undo();
                props.notify(error instanceof Error ? error.message : 'Não foi possível gravar.', 'error');
            } finally {
                pending.current -= 1;
                refreshSoon();
            }
        };
        return {
            add: values => {
                const temp: HotelLine = { id: `tmp-${Date.now()}-${Math.random()}`, notes: null, payOnSite: false, ...values };
                setLines(list => [...list, temp]);
                void track(async () => {
                    const [row] = await props.api.addLines(stay.id, [{ ...values, order: lines.length + 1 }]) as { id: string }[];
                    setLines(list => list.map(line => (line.id === temp.id ? { ...line, id: String(row.id) } : line)));
                }, () => setLines(list => list.filter(line => line.id !== temp.id)));
            },
            patch: (id, values) => {
                const before = lines.find(line => line.id === id);
                setLines(list => list.map(line => (line.id === id ? { ...line, ...values } : line)));
                void track(() => props.api.patchLine(stay.id, id, values).then(() => undefined),
                    () => before && setLines(list => list.map(line => (line.id === id ? before : line))));
            },
            remove: id => {
                const index = lines.findIndex(line => line.id === id);
                const before = lines[index];
                setLines(list => list.filter(line => line.id !== id));
                void track(() => props.api.deleteLine(stay.id, id).then(() => undefined),
                    () => before && setLines(list => [...list.slice(0, index), before, ...list.slice(index)]));
            },
        };
    }, [lines, props, refreshSoon, stay.id]);
    const local = linesSummary(lines);

    // --- Os passos, sempre pela mesma ordem --------------------------------
    const paidAll = cost.transferTotal > 0 && stay.paidAmount + 0.5 >= cost.transferTotal;
    const paidCount = schedule.items.filter(i => i.state === 'paid').length;
    const steps: { key: StepKey; title: string; todo: string; done: boolean; summary: string }[] = [
        {
            key: 'lines', title: 'Conta do hotel', todo: 'Copie as linhas da proforma, tal como o hotel as enviou.',
            done: lines.length > 0,
            summary: `${lines.length} ${lines.length === 1 ? 'linha' : 'linhas'} · ${eur(local.total)}`,
        },
        {
            key: 'proforma', title: 'Proforma', todo: 'Registe o total e anexe a proforma. Fica também na Contabilidade.',
            done: !!stay.agreement?.hasProforma,
            summary: stay.agreement ? `Registada · ${eur(stay.agreement.total)}${stay.agreement.hasProforma ? ' · ficheiro anexado' : ' · falta o ficheiro'}` : '',
        },
        {
            key: 'plan', title: 'Plano de pagamentos', todo: 'Escreva as datas e valores que o hotel pede. Os avisos aparecem 7 dias antes.',
            done: schedule.items.length > 0,
            summary: schedule.next
                ? `${schedule.items.length} prestações · próxima ${day(schedule.next.dueDate)} · ${eur(schedule.next.left)}`
                : `${schedule.items.length} prestações · todas pagas`,
        },
        {
            key: 'bank', title: 'Pagamentos do banco', todo: 'Ligue cada transferência feita ao hotel. O pago atualiza-se sozinho.',
            done: paidAll,
            summary: `${eur(stay.paidAmount)} pagos${schedule.items.length ? ` · ${paidCount} de ${schedule.items.length} prestações` : ''}`,
        },
        {
            key: 'invoice', title: 'Fatura final', todo: 'Quando o hotel enviar a fatura, junte-a aqui.',
            done: !!stay.agreement?.hasFinalInvoice,
            summary: 'Fatura final anexada',
        },
    ];
    const current = steps.find(step => !step.done) ?? null;
    const [openKey, setOpenKey] = useState<StepKey | null>(() => {
        const wanted = STEP_FROM_TAB[tab];
        if (wanted) return wanted;
        if (tab === 'pagamentos') return schedule.items.length ? 'bank' : 'plan';
        return current?.key ?? null;
    });
    const toggle = (key: StepKey) => setOpenKey(open => (open === key ? null : key));
    const goTo = (key: StepKey) => setOpenKey(key);

    const shared = { ...props, detail, run, goTo, lines, lineOps };
    // Sem proforma, o custo segue as linhas que estão no ecrã (já com o que se acabou de escrever).
    const shownCost = stay.agreement ? cost.transferTotal : lines.length ? local.transfer : cost.estimate;
    const left = Math.max(0, shownCost - stay.paidAmount);
    const source = stay.agreement ? 'pela proforma' : lines.length ? 'pelas linhas da conta' : 'estimativa, sem proforma';

    return (
        // A camada inteira anima e sai sozinha: nada fica montado, invisível, a tapar cliques.
        <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.18 }}
        >
            <div className="hg-scrim absolute inset-0" onClick={onClose} aria-hidden />
            <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98, transition: { duration: 0.16 } }}
                transition={SPRING}
                role="dialog"
                aria-modal="true"
                aria-label={stay.hotel || 'Hotel'}
                className="hg-sheet relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-[32px] md:max-w-[880px] md:rounded-[32px]"
            >
                {/* Cabeçalho: quem é, e o dinheiro em três números com legenda. */}
                <header className="border-b border-zinc-900/[0.06] px-5 pb-5 pt-5 md:px-8 md:pt-7">
                    <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-[22px] font-semibold tracking-tight text-zinc-900">{stay.hotel || 'Hotel sem nome'}</h2>
                            <p className="mt-0.5 truncate text-[14px] text-zinc-500">
                                {[stay.city, `${range(stay.checkIn, stay.checkOut)} · ${cost.nights} ${cost.nights === 1 ? 'noite' : 'noites'}`].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Fechar" className="hg-pill flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        <Figure label="Custo" value={eur(shownCost)} hint={source} />
                        <Figure label="Pago" value={eur(stay.paidAmount)} hint={stay.agreement ? 'pelo banco' : 'sem ligação ao banco'} tone={paidAll ? 'ok' : 'neutral'} />
                        <Figure label="Falta pagar" value={eur(left)}
                            hint={schedule.next ? `próxima ${day(schedule.next.dueDate)}` : left > 0 ? 'sem datas' : 'nada'}
                            tone={schedule.overdue.length ? 'late' : schedule.dueSoon.length ? 'soon' : 'neutral'} />
                    </div>
                    {local.onSite > 0 && <p className="mt-2 text-[12.5px] text-zinc-500">+ {eur(local.onSite)} a pagar no hotel, à chegada.</p>}
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
                    {current ? (
                        <p className="mb-4 px-1 text-[14px] text-zinc-600">
                            <span className="font-semibold text-zinc-900">O que falta agora:</span> {current.title.toLowerCase()}. {current.todo}
                        </p>
                    ) : (
                        <p className="mb-4 flex items-center gap-2 px-1 text-[14px] text-emerald-700"><Check className="h-4 w-4" /> Este hotel está completo: pago e com fatura final.</p>
                    )}

                    <ol className="space-y-2.5">
                        {steps.map((step, i) => (
                            <StepCard
                                key={step.key}
                                n={i + 1}
                                title={step.title}
                                todo={step.todo}
                                summary={step.summary}
                                done={step.done}
                                current={step === current}
                                open={openKey === step.key}
                                onToggle={() => toggle(step.key)}
                            >
                                {step.key === 'lines' && <LinesStep {...shared} />}
                                {step.key === 'proforma' && <ProformaStep {...shared} />}
                                {step.key === 'plan' && <PlanStep {...shared} />}
                                {step.key === 'bank' && <BankStep {...shared} />}
                                {step.key === 'invoice' && <InvoiceStep {...shared} />}
                            </StepCard>
                        ))}
                    </ol>

                    <div className="mt-6">
                        <button type="button" onClick={() => toggle('details')}
                            className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left hover:bg-zinc-900/[0.03]">
                            <span>
                                <span className="block text-[14px] font-semibold text-zinc-900">Dados do hotel</span>
                                <span className="block text-[12.5px] text-zinc-500">Nome, datas, estado da reserva, contacto, prazos e notas</span>
                            </span>
                            <ChevronDown className={cx('h-4 w-4 text-zinc-400 transition-transform duration-200', openKey === 'details' && 'rotate-180')} />
                        </button>
                        <AnimatePresence initial={false}>
                            {openKey === 'details' && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
                                    <div className="px-1 pb-2 pt-3"><DetailsSection {...shared} /></div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

function Figure({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint: string; tone?: 'neutral' | 'ok' | 'soon' | 'late' }) {
    return (
        <div className="hg-well rounded-2xl px-3.5 py-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</p>
            <p className={cx('mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight md:text-[20px]',
                tone === 'ok' ? 'text-emerald-700' : tone === 'late' ? 'text-rose-600' : tone === 'soon' ? 'text-amber-600' : 'text-zinc-900')}>{value}</p>
            <p className="truncate text-[12px] text-zinc-500">{hint}</p>
        </div>
    );
}

/** Um passo: número, título, e o resumo quando está feito. Abre para editar. */
function StepCard({ n, title, todo, summary, done, current, open, onToggle, children }: {
    n: number; title: string; todo: string; summary: string; done: boolean; current: boolean; open: boolean;
    onToggle: () => void; children: ReactNode;
}) {
    return (
        <li className={cx('rounded-[22px] transition-colors duration-200', open ? 'hg-glass' : current ? 'bg-white/70 ring-1 ring-zinc-900/10' : 'hover:bg-white/50')}>
            <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left">
                <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold',
                    done ? 'bg-emerald-500 text-white' : current ? 'bg-zinc-900 text-white' : 'bg-zinc-900/[0.06] text-zinc-500')}>
                    {done ? <Check className="h-4 w-4" /> : n}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-zinc-900">{title}</span>
                    <span className={cx('block truncate text-[13px]', done ? 'text-zinc-600' : 'text-zinc-500')}>{done ? summary : todo}</span>
                </span>
                <span className={cx('shrink-0 text-[12.5px] font-medium', open ? 'text-zinc-400' : current ? 'text-zinc-900' : 'text-zinc-500')}>
                    {open ? 'Fechar' : done ? 'Editar' : current ? 'Começar' : 'Abrir'}
                </span>
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
                        <div className="border-t border-zinc-900/[0.06] px-4 pb-5 pt-4 md:px-5">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </li>
    );
}

type LineOps = {
    add: (values: Omit<HotelLine, 'id' | 'notes' | 'payOnSite'> & { payOnSite?: boolean }) => void;
    patch: (id: string, values: Partial<Omit<HotelLine, 'id'>>) => void;
    remove: (id: string) => void;
};

type StepProps = Props & { detail: AgreementDetail | null; run: Run; goTo: (key: StepKey) => void; lines: HotelLine[]; lineOps: LineOps };

const Note = ({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'info'; children: ReactNode }) => (
    <div className={cx('rounded-2xl px-4 py-3 text-[13.5px]',
        tone === 'ok' ? 'bg-emerald-500/10 text-emerald-800' : tone === 'warn' ? 'bg-amber-500/10 text-amber-800'
            : tone === 'info' ? 'bg-sky-500/10 text-sky-800' : 'hg-well text-zinc-600')}>
        {children}
    </div>
);

const fieldClass = 'h-10 w-full rounded-xl bg-white px-3 text-[14px] text-zinc-900 ring-1 ring-zinc-900/10 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/30';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-zinc-700">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-[12px] text-zinc-500">{hint}</span>}
        </label>
    );
}

// ---------------------------------------------------------------------------
// 1. Conta do hotel: a tabela da proforma, por grupos.

/** Pela ordem em que os hotéis as escrevem na proforma. */
const GROUPS: { kind: HotelLineKind; title: string }[] = [
    { kind: 'room', title: 'Quartos' },
    { kind: 'discount', title: 'Gratuidades e descontos' },
    { kind: 'supplement', title: 'Suplementos' },
    { kind: 'tax', title: 'Taxas' },
    { kind: 'other', title: 'Outros' },
];

const QUICK: { key: string; kind: HotelLineKind; button: string; label: string; placeholder: string; help: string }[] = [
    { key: 'room', kind: 'room', button: 'Quarto', label: '', placeholder: 'Ex.: Twin HB', help: 'Quartos × noites × preço por quarto.' },
    { key: 'free', kind: 'discount', button: 'Gratuidade (free)', label: 'Gratuidade', placeholder: 'Ex.: Free pax in double', help: 'Pessoas grátis × noites × valor por pessoa. Conta a menos.' },
    { key: 'supplement', kind: 'supplement', button: 'Suplemento', label: '', placeholder: 'Ex.: Água, vinho, café…', help: 'Pessoas × noites × preço por pessoa.' },
    { key: 'discount', kind: 'discount', button: 'Desconto', label: 'Desconto', placeholder: 'Ex.: Desconto de grupo', help: 'Escreva 1 × 1 × valor do desconto. Conta a menos.' },
    { key: 'tax', kind: 'tax', button: 'Taxa turística', label: 'Taxa turística', placeholder: 'Ex.: City tax', help: 'Pessoas × noites × taxa por pessoa. Marque se se paga no hotel.' },
    { key: 'other', kind: 'other', button: 'Outro', label: '', placeholder: 'Descrição', help: 'Quantidade × noites × preço.' },
];

const GRID = 'grid grid-cols-[minmax(0,1fr)_72px_64px_96px_108px_32px] items-center gap-1.5';

function LinesStep({ view, lines, lineOps }: StepProps) {
    const { stay } = view;
    const nights = nightsBetween(stay.checkIn, stay.checkOut);
    const summary = linesSummary(lines);
    const [quick, setQuick] = useState(QUICK[0]);
    const [quickSeq, setQuickSeq] = useState(0);
    const number = (line: HotelLine, key: 'qty' | 'nights' | 'unitPrice') => (text: string) => {
        const value = parseAmount(text);
        if (value !== null) lineOps.patch(line.id, { [key]: key === 'nights' ? Math.round(value) : value });
    };

    return (
        <div className="space-y-4">
            {lines.length === 0 && (
                <Note>
                    Copie a proforma do hotel, uma linha de cada vez. Por exemplo, no La Meridiana: <strong>Twin HB · 24 quartos · 2 noites · 138 €</strong>.
                    As gratuidades (free) e os descontos entram como linhas e contam a menos.
                </Note>
            )}

            <div className="-mx-1 overflow-x-auto px-1">
                <div className="min-w-[600px]">
                    <div className={cx(GRID, 'px-1 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-zinc-400')}>
                        <span className="px-2.5">Serviço</span><span className="text-right">Qtd</span><span className="text-right">Noites</span>
                        <span className="text-right">Preço</span><span className="pr-1 text-right">Total</span><span />
                    </div>

                    {GROUPS.map(group => {
                        const rows = lines.filter(line => line.kind === group.kind);
                        if (!rows.length) return null;
                        const subtotal = rows.reduce((sum, line) => sum + lineTotal(line), 0);
                        return (
                            <div key={group.kind} className="mt-3 first:mt-1">
                                <div className="flex items-baseline justify-between px-2.5 pb-1">
                                    <span className="text-[12.5px] font-semibold text-zinc-600">{group.title}</span>
                                    <span className={cx('pr-[38px] text-[12.5px] tabular-nums', subtotal < 0 ? 'text-emerald-700' : 'text-zinc-500')}>{eur(subtotal)}</span>
                                </div>
                                <div className="space-y-1">
                                    {rows.map(line => {
                                        const total = lineTotal(line);
                                        const saving = line.id.startsWith('tmp-');
                                        return (
                                            <div key={line.id} className={cx(GRID, 'rounded-xl bg-white/80 px-1 py-0.5 ring-1 ring-zinc-900/[0.05] transition-opacity', saving && 'opacity-60')}>
                                                <div className="min-w-0">
                                                    <InlineInput value={line.label} placeholder="Descrição" ariaLabel="Serviço" disabled={saving} onCommit={value => lineOps.patch(line.id, { label: value })} />
                                                    {line.kind === 'tax' && (
                                                        <label className="flex cursor-pointer items-center gap-1.5 px-2.5 pb-1 text-[11.5px] text-zinc-500">
                                                            <input type="checkbox" checked={line.payOnSite} disabled={saving} onChange={e => lineOps.patch(line.id, { payOnSite: e.target.checked })} className="h-3 w-3 accent-zinc-900" />
                                                            paga-se no hotel, à chegada
                                                        </label>
                                                    )}
                                                </div>
                                                <InlineInput kind="number" align="right" value={line.qty} ariaLabel="Quantidade" disabled={saving} onCommit={number(line, 'qty')} />
                                                <InlineInput kind="number" align="right" value={line.nights} ariaLabel="Noites" disabled={saving} onCommit={number(line, 'nights')} />
                                                <InlineInput kind="number" align="right" value={line.unitPrice} ariaLabel="Preço" disabled={saving} onCommit={number(line, 'unitPrice')} />
                                                <span className={cx('pr-1 text-right text-[14px] font-semibold tabular-nums', total < 0 ? 'text-emerald-700' : 'text-zinc-900')}>{eur(total)}</span>
                                                <button type="button" disabled={saving} onClick={() => lineOps.remove(line.id)} aria-label="Apagar linha" title="Apagar linha"
                                                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:bg-rose-500/10 hover:text-rose-600">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {lines.length > 0 && (
                        <div className={cx(GRID, 'mt-3 border-t border-zinc-900/[0.08] px-1 pt-3')}>
                            <span className="col-span-4 px-2.5 text-[14px] font-semibold text-zinc-900">Total da conta</span>
                            <span className="pr-1 text-right text-[17px] font-semibold tabular-nums text-zinc-900">{eur(summary.total)}</span>
                            <span />
                        </div>
                    )}
                    {summary.onSite > 0 && (
                        <p className="px-[46px] pt-1 text-right text-[12.5px] text-zinc-500">Por transferência {eur(summary.transfer)} · no hotel {eur(summary.onSite)}</p>
                    )}
                </div>
            </div>

            <div className="rounded-[18px] bg-zinc-900/[0.03] p-3">
                <p className="mb-2 px-1 text-[13px] font-medium text-zinc-700">Acrescentar</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                    {QUICK.map(item => (
                        <button key={item.key} type="button" onClick={() => { setQuick(item); setQuickSeq(n => n + 1); }}
                            className={cx('h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150',
                                quick.key === item.key ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-900/10 hover:ring-zinc-900/25')}>
                            {item.button}
                        </button>
                    ))}
                </div>
                <NewLineRow key={quickSeq} preset={quick} nights={nights} onAdd={lineOps.add} focus={quickSeq > 0} />
                <p className="mt-2 px-1 text-[12.5px] text-zinc-500">{quick.help} Enter para acrescentar.</p>
            </div>
        </div>
    );
}

/** A linha de acrescentar, já com o tipo escolhido. Fica com o mesmo tipo para a próxima. */
function NewLineRow({ preset, nights, onAdd, focus }: {
    preset: (typeof QUICK)[number]; nights: number; focus: boolean;
    onAdd: LineOps['add'];
}) {
    const empty = { label: preset.label, qty: '', nights: String(nights), unitPrice: '' };
    const [row, setRow] = useState(empty);
    const first = useRef<HTMLInputElement>(null);
    useEffect(() => { if (focus) first.current?.focus(); }, [focus]);
    const qty = parseAmount(row.qty);
    const price = parseAmount(row.unitPrice);
    const lineNights = parseAmount(row.nights);
    const ready = row.label.trim() !== '' && qty !== null && price !== null && lineNights !== null;
    const preview = ready ? lineTotal({ kind: preset.kind, qty: qty!, nights: lineNights!, unitPrice: price! }) : null;

    const submit = () => {
        if (!ready) return;
        onAdd({ kind: preset.kind, label: row.label.trim(), qty: qty!, nights: Math.round(lineNights!), unitPrice: price! });
        setRow({ ...empty, nights: row.nights });
        first.current?.focus();
    };
    const onKey = (event: React.KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } };
    const input = 'h-10 w-full rounded-lg bg-white px-2.5 text-[14px] ring-1 ring-zinc-900/10 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/25';

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_72px_64px_96px_108px_40px] items-center gap-1.5 max-md:grid-cols-4">
            <input ref={first} value={row.label} onChange={e => setRow({ ...row, label: e.target.value })} onKeyDown={onKey}
                placeholder={preset.placeholder} aria-label="Descrição" className={cx(input, 'max-md:col-span-4')} />
            <input inputMode="decimal" value={row.qty} onChange={e => setRow({ ...row, qty: e.target.value })} onKeyDown={onKey} placeholder="Qtd" aria-label="Quantidade" className={cx(input, 'text-right tabular-nums')} />
            <input inputMode="decimal" value={row.nights} onChange={e => setRow({ ...row, nights: e.target.value })} onKeyDown={onKey} aria-label="Noites" title="Noites" className={cx(input, 'text-right tabular-nums')} />
            <input inputMode="decimal" value={row.unitPrice} onChange={e => setRow({ ...row, unitPrice: e.target.value })} onKeyDown={onKey} placeholder="Preço" aria-label="Preço" className={cx(input, 'text-right tabular-nums')} />
            <span className={cx('pr-1 text-right text-[14px] tabular-nums max-md:hidden', preview !== null && preview < 0 ? 'text-emerald-700' : 'text-zinc-400')}>{preview === null ? '—' : eur(preview)}</span>
            <button type="button" onClick={submit} disabled={!ready} aria-label="Acrescentar linha" title="Acrescentar (Enter)"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors disabled:bg-zinc-900/15">
                <Plus className="h-4 w-4" />
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 2. Proforma: o acordo na Contabilidade.

function ProformaStep({ view, pilgrimageId, run, detail, goTo, lines }: StepProps) {
    const { stay } = view;
    // As linhas que estão no ecrã, já com o que se acabou de escrever.
    const linesTotal = lines.length ? linesSummary(lines).transfer : null;
    const [supplier, setSupplier] = useState(stay.hotel);
    const [total, setTotal] = useState(linesTotal ? String(linesTotal).replace('.', ',') : '');
    const [file, setFile] = useState<File | null>(null);
    const picker = useRef<HTMLInputElement>(null);

    if (!stay.agreement) {
        const value = parseAmount(total) ?? 0;
        const missing = !supplier.trim() ? 'Escreva o nome do hotel.' : value <= 0 ? 'Escreva o total da proforma.' : null;
        return (
            <div className="space-y-4">
                {linesTotal === null && (
                    <Note tone="info">Ainda não copiou as linhas. Pode registar já o total da proforma, mas com as linhas consegue confirmar que a conta do hotel está certa. <button type="button" onClick={() => goTo('lines')} className="font-semibold underline underline-offset-2">Ir para a conta</button></Note>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Hotel (fornecedor)"><input value={supplier} onChange={e => setSupplier(e.target.value)} className={fieldClass} /></Field>
                    <Field label="Total da proforma, em €" hint={linesTotal !== null ? `A conta das linhas dá ${eur(linesTotal)}.` : 'O que vai transferir ao hotel, no total.'}>
                        <input inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="Ex.: 13.492,00" className={cx(fieldClass, 'tabular-nums')} />
                    </Field>
                </div>
                <Field label="Ficheiro da proforma" hint="PDF ou fotografia, como o hotel enviou.">
                    <button type="button" onClick={() => picker.current?.click()}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-zinc-300 bg-white px-3.5 py-3 text-left text-[14px] text-zinc-700 hover:border-zinc-500">
                        {file ? <FileText className="h-4 w-4 text-emerald-600" /> : <Upload className="h-4 w-4 text-zinc-400" />}
                        <span className="truncate">{file ? file.name : 'Escolher ficheiro…'}</span>
                    </button>
                </Field>
                <input ref={picker} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="primary" disabled={!!missing} onClick={() => void run(async () => {
                        const created = await agreementApi.create({ pilgrimageId, supplier: supplier.trim(), totalAmount: value, hotelStayId: stay.id });
                        if (file) await agreementApi.attach(created.id, await shrinkPhoto(file), 'proforma');
                        goTo('plan');
                    }, 'Proforma registada')}>
                        <Landmark className="h-4 w-4" /> Registar proforma
                    </Button>
                    {missing && <span className="text-[13px] text-zinc-500">{missing}</span>}
                </div>
            </div>
        );
    }

    const a = detail?.agreement;
    const proformas = detail?.documents.filter(d => d.onAgreement && d.kind === 'proforma') ?? [];
    const mismatch = linesTotal !== null && Math.abs(linesTotal - stay.agreement.total) > 1;
    const updateTotal = (value: number) => a && run(() => agreementApi.update(a.id, {
        supplier: a.supplier, description: a.description, totalAmount: value, paidOutsideBank: a.paidOutsideBank, hotelStayId: stay.id,
    }), 'Total da proforma corrigido');

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Total da proforma, em €" hint="Corrija se o hotel mandar outra proforma.">
                    <InlineInput kind="number" align="right" value={stay.agreement.total} ariaLabel="Total da proforma"
                        className="rounded-xl bg-white ring-1 ring-zinc-900/10"
                        onCommit={value => { const v = parseAmount(value); if (v !== null) void updateTotal(v); }} />
                </Field>
                <div>
                    <span className="mb-1.5 block text-[13px] font-medium text-zinc-700">Ficheiro</span>
                    {proformas.length ? (
                        <ul className="space-y-1">
                            {proformas.map(doc => (
                                <li key={doc.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[13.5px] ring-1 ring-zinc-900/10">
                                    <FileText className="h-4 w-4 text-emerald-600" />
                                    <span className="min-w-0 flex-1 truncate">{doc.fileName || 'proforma'}</span>
                                    {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-[12.5px] font-medium text-zinc-600 hover:text-zinc-900">Abrir</a>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Note tone="warn">Falta anexar o ficheiro da proforma.</Note>
                    )}
                    <AttachButton label={proformas.length ? 'Juntar outra versão' : 'Anexar proforma'} onFile={async f => { await run(async () => agreementApi.attach(stay.agreement!.id, await shrinkPhoto(f), 'proforma'), 'Proforma anexada'); }} />
                </div>
            </div>
            {mismatch && (
                <Note tone="warn">
                    A conta das linhas dá <strong className="tabular-nums">{eur(linesTotal!)}</strong> e a proforma registada diz <strong className="tabular-nums">{eur(stay.agreement.total)}</strong>.{' '}
                    <button type="button" onClick={() => void updateTotal(linesTotal!)} className="font-semibold underline underline-offset-2">Usar {eur(linesTotal!)}</button>
                </Note>
            )}
            <p className="text-[12.5px] text-zinc-500">
                Este registo é o acordo com o hotel na Contabilidade. <Link href="/admin/contabilidade" className="font-medium text-zinc-700 underline-offset-2 hover:underline">Abrir a Contabilidade <ArrowUpRight className="inline h-3 w-3" /></Link>
            </p>
        </div>
    );
}

function AttachButton({ label, onFile }: { label: string; onFile: (file: File) => Promise<void> }) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <>
            <Button onClick={() => ref.current?.click()} className="mt-2 h-8 text-[12.5px]"><Upload className="h-3.5 w-3.5" /> {label}</Button>
            <input ref={ref} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => {
                const chosen = e.target.files?.[0];
                e.target.value = '';
                if (chosen) void onFile(chosen);
            }} />
        </>
    );
}

// ---------------------------------------------------------------------------
// 3. Plano de pagamentos.

function PlanStep({ view, api, run }: StepProps) {
    const { stay, cost, schedule } = view;
    if (!schedule.items.length) {
        return <ScheduleForm total={cost.transferTotal} onSave={items => run(() => api.addInstallments(stay.id, items), 'Plano de pagamentos guardado')} />;
    }
    const diff = Math.round((schedule.sum - cost.transferTotal) * 100) / 100;
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_150px_130px_120px_32px] gap-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-zinc-400 max-md:hidden">
                <span className="px-2.5">Prestação</span><span className="px-2.5">Pagar até</span><span className="pr-2.5 text-right">Valor</span><span className="px-2">Estado</span><span />
            </div>
            <div className="space-y-1">
                {schedule.items.map(item => (
                    <div key={item.id} className="grid grid-cols-2 items-center gap-1.5 rounded-xl bg-white/70 px-1 py-0.5 ring-1 ring-zinc-900/[0.05] md:grid-cols-[minmax(0,1fr)_150px_130px_120px_32px]">
                        <InlineInput value={item.label} ariaLabel="Nome da prestação" onCommit={value => void run(() => api.patchInstallment(stay.id, item.id, { label: value }))} />
                        <InlineInput kind="date" value={item.dueDate} ariaLabel="Pagar até" onCommit={value => value && void run(() => api.patchInstallment(stay.id, item.id, { dueDate: value }))} />
                        <InlineInput kind="number" align="right" value={item.amount} ariaLabel="Valor"
                            onCommit={value => { const v = parseAmount(value); if (v !== null) void run(() => api.patchInstallment(stay.id, item.id, { amount: v })); }} />
                        <span className="px-2">
                            <Chip tone={item.state === 'paid' ? 'ok' : item.state === 'overdue' ? 'late' : item.state === 'due_soon' ? 'soon' : item.state === 'partial' ? 'info' : 'neutral'}>
                                {item.state === 'paid' ? 'Paga' : item.state === 'overdue' ? 'Em atraso'
                                    : item.state === 'due_soon' ? (item.daysLeft === 0 ? 'Vence hoje' : `Vence em ${item.daysLeft} d`)
                                        : item.state === 'partial' ? `Falta ${eur(item.left)}` : 'Por pagar'}
                            </Chip>
                        </span>
                        <button type="button" aria-label="Apagar prestação" onClick={() => void run(() => api.deleteInstallment(stay.id, item.id))}
                            className="flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-zinc-300 hover:bg-rose-500/10 hover:text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" onClick={() => void run(() => api.addInstallment(stay.id, {
                    label: `${schedule.items.length + 1}.ª prestação`, dueDate: schedule.items.slice(-1)[0]?.dueDate || stay.checkIn, amount: Math.max(0, -diff),
                }))} className="h-8 text-[12.5px]"><Plus className="h-3.5 w-3.5" /> Prestação</Button>
                <span className="flex-1" />
                {Math.abs(diff) > 1
                    ? <Chip tone="soon">Somam {eur(schedule.sum)} · {diff < 0 ? `faltam ${eur(-diff)}` : `${eur(diff)} a mais`} do custo</Chip>
                    : <Chip tone="ok">Somam {eur(schedule.sum)}, o custo todo</Chip>}
            </div>
        </div>
    );
}

/** As prestações tal como vêm na proforma. Começa com 30/50/20 do custo, mas escreve-se por cima. */
function ScheduleForm({ total, onSave }: { total: number; onSave: (items: { label: string; dueDate: string; amount: number }[]) => Promise<boolean> }) {
    const base = splitInstallments(total > 0 ? total : 0);
    const [rows, setRows] = useState(() => ['1.º sinal', '2.º sinal', 'Saldo'].map((label, i) => ({
        label, dueDate: '', amount: total > 0 ? String(base[i]).replace('.', ',') : '',
    })));
    const [saving, setSaving] = useState(false);
    const sum = rows.reduce((a, row) => a + (parseAmount(row.amount) ?? 0), 0);
    const filled = rows.filter(row => row.dueDate && (parseAmount(row.amount) ?? 0) > 0);
    const missingDate = rows.some(row => (parseAmount(row.amount) ?? 0) > 0 && !row.dueDate);
    const missing = missingDate ? 'Falta a data de alguma prestação.' : !filled.length ? 'Escreva pelo menos uma prestação com data e valor.' : null;
    const set = (i: number, key: 'label' | 'dueDate' | 'amount', value: string) => setRows(list => list.map((row, j) => (j === i ? { ...row, [key]: value } : row)));

    return (
        <div className="space-y-3">
            <p className="text-[13px] text-zinc-600">Os valores começam em 30 % / 50 % / 20 % do custo. Escreva por cima as datas e os valores exatos da proforma.</p>
            <div className="grid grid-cols-[minmax(0,1fr)_160px_140px_32px] gap-2 px-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-zinc-400 max-md:hidden">
                <span>Prestação</span><span>Pagar até</span><span className="text-right">Valor, em €</span><span />
            </div>
            {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_160px_140px_32px]">
                    <input value={row.label} onChange={e => set(i, 'label', e.target.value)} aria-label="Nome da prestação" className={cx(fieldClass, 'col-span-2 md:col-span-1')} />
                    <input type="date" value={row.dueDate} onChange={e => set(i, 'dueDate', e.target.value)} aria-label="Pagar até" className={cx(fieldClass, !row.dueDate && 'text-zinc-400')} />
                    <input inputMode="decimal" value={row.amount} onChange={e => set(i, 'amount', e.target.value)} aria-label="Valor" className={cx(fieldClass, 'text-right tabular-nums')} />
                    <button type="button" aria-label="Tirar esta prestação" onClick={() => setRows(list => list.filter((_, j) => j !== i))}
                        className="hidden h-10 w-8 items-center justify-center rounded-full text-zinc-300 hover:text-rose-600 md:flex"><X className="h-3.5 w-3.5" /></button>
                </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={() => setRows(list => [...list, { label: `${list.length + 1}.ª prestação`, dueDate: '', amount: '' }])} className="h-8 text-[12.5px]"><Plus className="h-3.5 w-3.5" /> Prestação</Button>
                <span className="flex-1" />
                <span className={cx('text-[13px] tabular-nums', total > 0 && Math.abs(sum - total) > 1 ? 'font-medium text-amber-700' : 'text-zinc-500')}>
                    Soma {eur(sum)}{total > 0 && ` de ${eur(total)}`}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" disabled={!!missing || saving} onClick={async () => {
                    setSaving(true);
                    await onSave(filled.map(row => ({ label: row.label.trim() || 'Prestação', dueDate: row.dueDate, amount: parseAmount(row.amount) ?? 0 })));
                    setSaving(false);
                }}>
                    <CalendarClock className="h-4 w-4" /> Guardar plano
                </Button>
                {missing && <span className="text-[13px] text-zinc-500">{missing}</span>}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 4. Pagamentos do banco.

function BankStep({ view, detail, run, goTo }: StepProps) {
    const { stay, cost } = view;
    if (!stay.agreement) {
        return (
            <Note tone="info">
                Os pagamentos ligam-se à proforma. Registe-a primeiro (passo 2).{' '}
                <button type="button" onClick={() => goTo('proforma')} className="font-semibold underline underline-offset-2">Ir para a proforma</button>
            </Note>
        );
    }
    return <BankPayments agreementId={stay.agreement.id} detail={detail} run={run} remaining={Math.max(0, cost.transferTotal - stay.paidAmount)} />;
}

/** Pagamentos já ligados e, por baixo, os débitos do banco que podem ser deste hotel. */
function BankPayments({ agreementId, detail, run, remaining }: { agreementId: string; detail: AgreementDetail | null; remaining: number; run: Run }) {
    const [candidates, setCandidates] = useState<PaymentCandidateView[] | null>(null);
    const [showAll, setShowAll] = useState(false);
    const load = useCallback(async () => {
        try { setCandidates((await agreementApi.candidates(agreementId)).candidates); } catch { setCandidates([]); }
    }, [agreementId]);
    useEffect(() => { void load(); }, [load, detail?.agreement.paid]);
    const suggested = (candidates ?? []).filter(c => c.reason);
    const others = (candidates ?? []).filter(c => !c.reason);
    const shown = showAll ? [...suggested, ...others] : suggested;

    return (
        <div className="space-y-4">
            <div>
                <p className="mb-1.5 text-[13px] font-medium text-zinc-700">Já ligados</p>
                {detail && detail.payments.length > 0 ? (
                    <ul className="space-y-1">
                        {detail.payments.map(payment => (
                            <li key={payment.id} className="flex items-center gap-3 rounded-xl bg-white/70 px-3.5 py-2.5 text-[13.5px] ring-1 ring-zinc-900/[0.05]">
                                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                                <span className="w-16 shrink-0 tabular-nums text-zinc-500">{day(payment.booking_date)}</span>
                                <span className="min-w-0 flex-1 truncate text-zinc-500">{payment.description_raw}</span>
                                <span className="font-semibold tabular-nums text-zinc-900">{eur(Math.abs(Number(payment.amount)))}</span>
                                <button type="button" title="Desligar (foi engano)" aria-label="Desligar este pagamento"
                                    onClick={() => void run(() => agreementApi.unlinkPayment(payment.id), 'Pagamento desligado')}
                                    className="rounded-full p-1.5 text-zinc-300 hover:bg-zinc-900/5 hover:text-zinc-600"><X className="h-3.5 w-3.5" /></button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-[13px] text-zinc-500">Nenhum ainda.</p>
                )}
            </div>

            {remaining <= 0.5 ? (
                <Note tone="ok">Este hotel está todo pago.</Note>
            ) : (
                <div>
                    <p className="mb-1.5 text-[13px] font-medium text-zinc-700">
                        {candidates === null ? 'A procurar no banco…' : suggested.length ? 'No banco, parecem ser deste hotel:' : 'Nenhum débito do banco parece ser deste hotel.'}
                    </p>
                    <ul className="space-y-1">
                        {shown.map(c => (
                            <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white/70 px-3.5 py-2 ring-1 ring-zinc-900/[0.05]">
                                <span className="w-14 shrink-0 text-[13px] tabular-nums text-zinc-500">{day(c.bookingDate)}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13.5px] text-zinc-800">{c.counterparty || c.description}</span>
                                    {c.reason && <span className="block text-[12px] font-medium text-emerald-700">{c.reason}</span>}
                                </span>
                                <span className="text-[14px] font-semibold tabular-nums text-zinc-900">{eur(Math.abs(c.amount))}</span>
                                <Button variant={c.reason ? 'primary' : 'secondary'} className="h-8 px-3.5 text-[12.5px]"
                                    onClick={() => void run(() => agreementApi.linkPayment(c.id, agreementId), 'Pagamento ligado ao hotel')}>
                                    Ligar
                                </Button>
                            </li>
                        ))}
                    </ul>
                    {others.length > 0 && (
                        <button type="button" onClick={() => setShowAll(v => !v)} className="mt-1.5 px-1 text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900">
                            {showAll ? 'Mostrar só os que parecem ser deste hotel' : `Não está aqui? Ver mais ${others.length} débitos recentes`}
                        </button>
                    )}
                </div>
            )}
            <p className="text-[12.5px] text-zinc-500">
                O movimento ligado continua na Contabilidade para aprovar; já leva a categoria «Alojamento e refeições» e a proforma como documento.
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 5. Fatura final.

function InvoiceStep({ view, run, detail, goTo }: StepProps) {
    const { stay } = view;
    if (!stay.agreement) {
        return <Note tone="info">A fatura junta-se à proforma. Registe-a primeiro (passo 2). <button type="button" onClick={() => goTo('proforma')} className="font-semibold underline underline-offset-2">Ir para a proforma</button></Note>;
    }
    const invoices = detail?.documents.filter(d => d.onAgreement && (d.kind === 'fatura' || d.kind === 'recibo')) ?? [];
    return (
        <div className="space-y-3">
            {invoices.length ? (
                <ul className="space-y-1">
                    {invoices.map(doc => (
                        <li key={doc.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[13.5px] ring-1 ring-zinc-900/10">
                            <FileText className="h-4 w-4 text-emerald-600" />
                            <span className="min-w-0 flex-1 truncate">{doc.fileName || 'fatura'}</span>
                            {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-[12.5px] font-medium text-zinc-600 hover:text-zinc-900">Abrir</a>}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[13.5px] text-zinc-600">O hotel costuma enviar a fatura no fim, depois do último pagamento. Até lá, a proforma serve de documento dos pagamentos.</p>
            )}
            <AttachButton label="Anexar fatura final" onFile={async f => { await run(async () => agreementApi.attach(stay.agreement!.id, await shrinkPhoto(f), 'fatura'), 'Fatura final anexada'); }} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Dados do hotel.

function DetailsSection({ view, next, api, run, onClose }: StepProps) {
    const { stay } = view;
    const [confirmDelete, setConfirmDelete] = useState(false);
    const patch = (values: Record<string, unknown>, done?: string) => run(() => api.patchStay(stay.id, values), done);
    const canMerge = next && next.stay.checkIn === stay.checkOut;
    const box = 'rounded-xl bg-white ring-1 ring-zinc-900/10';

    return (
        <div className="space-y-5">
            <Field label="Estado da reserva">
                <div className="overflow-x-auto">
                    <Segmented size="sm" value={stay.status} onChange={status => void patch({ status })}
                        options={STATUS_STEPS.map(step => ({ value: step.value as string, label: step.label }))} />
                </div>
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Hotel"><InlineInput className={box} value={stay.hotel} placeholder="Nome do hotel" onCommit={hotel => void patch({ hotel })} /></Field>
                <Field label="Cidade"><InlineInput className={box} value={stay.city} placeholder="Cidade" onCommit={city => void patch({ city })} /></Field>
                <Field label="Entrada"><InlineInput className={box} kind="date" value={stay.checkIn} onCommit={v => v && void patch({ check_in: v })} /></Field>
                <Field label="Saída"><InlineInput className={box} kind="date" value={stay.checkOut} onCommit={v => v && void patch({ check_out: v })} /></Field>
                <Field label="Regime">
                    <select value={stay.board} onChange={e => void patch({ board: e.target.value })} className={cx(fieldClass, 'cursor-pointer')}>
                        {[...new Set([...BOARD_OPTIONS, stay.board].filter(Boolean))].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Contacto no hotel"><InlineInput className={box} value={stay.contactName} placeholder="Nome" onCommit={v => void patch({ contact_name: v })} /></Field>
                <Field label="Email">
                    <div className="flex items-center gap-1.5">
                        <InlineInput className={box} kind="email" value={stay.contactEmail} placeholder="email@hotel.it" onCommit={v => void patch({ contact_email: v })} />
                        {stay.contactEmail && <a href={`mailto:${stay.contactEmail}`} aria-label="Escrever email" className="hg-pill flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900"><Mail className="h-4 w-4" /></a>}
                    </div>
                </Field>
                <Field label="Telefone">
                    <div className="flex items-center gap-1.5">
                        <InlineInput className={box} kind="tel" value={stay.contactPhone} placeholder="+39 …" onCommit={v => void patch({ contact_phone: v })} />
                        {stay.contactPhone && <a href={`tel:${stay.contactPhone}`} aria-label="Ligar" className="hg-pill flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900"><Phone className="h-4 w-4" /></a>}
                    </div>
                </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="A pré-reserva expira em" hint="Avisa 7 dias antes, se a reserva não estiver confirmada.">
                    <InlineInput className={box} kind="date" value={stay.optionUntil} onCommit={v => void patch({ option_until: v || null })} />
                </Field>
                <Field label="Enviar a lista de quartos até" hint="Avisa 7 dias antes.">
                    <InlineInput className={box} kind="date" value={stay.roomingListDue} onCommit={v => void patch({ rooming_list_due: v || null })} />
                </Field>
            </div>
            <Field label="Notas">
                <textarea defaultValue={stay.notes || ''} rows={3} placeholder="Condições de cancelamento, o que falta confirmar…"
                    onBlur={e => { if (e.target.value !== (stay.notes || '')) void patch({ notes: e.target.value }); }}
                    className="w-full resize-none rounded-xl bg-white px-3 py-2.5 text-[14px] ring-1 ring-zinc-900/10 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/30" />
            </Field>
            <details className="hg-well rounded-2xl px-4 py-3">
                <summary className="cursor-pointer text-[13px] font-medium text-zinc-600">Estimativa antes de haver proforma (preço por pessoa)</summary>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {([
                        ['Partilhado, por noite', 'shared_price_per_night', stay.sharedPricePerNight],
                        ['Supl. individual, por noite', 'single_supplement_per_night', stay.singleSupplementPerNight],
                        ['Taxa, por pessoa e noite', 'city_tax_per_person_night', stay.cityTaxPerPersonNight],
                        ['1 grátis em cada', 'free_per_n', stay.freePerN],
                    ] as const).map(([label, key, value]) => (
                        <Field key={key} label={label}>
                            <InlineInput className={box} kind="number" align="right" value={value} onCommit={v => { const n = parseAmount(v); if (n !== null) void patch({ [key]: n }); }} />
                        </Field>
                    ))}
                </div>
                <p className="mt-2 text-[12px] text-zinc-500">Só conta enquanto o hotel não tiver linhas nem proforma.</p>
            </details>
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-900/[0.06] pt-4">
                {canMerge && (
                    <Button onClick={() => void run(() => api.mergeStays(stay.id, next!.stay.id), 'Hotéis juntados')}
                        title="Junta as duas estadias seguidas numa só; o total mantém-se.">
                        <Merge className="h-4 w-4" /> Juntar com {next!.stay.hotel || 'o seguinte'} ({range(next!.stay.checkIn, next!.stay.checkOut)})
                    </Button>
                )}
                <span className="flex-1" />
                {confirmDelete ? (
                    <span className="flex items-center gap-2 text-[13px] text-zinc-600">
                        Apagar este hotel?
                        <Button variant="ghost" onClick={() => setConfirmDelete(false)} className="h-8">Não</Button>
                        <Button variant="danger" onClick={() => void run(() => api.deleteStay(stay.id), 'Hotel apagado').then(ok => { if (ok) onClose(); })} className="h-8">Sim, apagar</Button>
                    </span>
                ) : (
                    <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Apagar hotel</Button>
                )}
            </div>
        </div>
    );
}
