"use client";

import './hotels.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BedDouble, CalendarClock, CheckCircle2, ChevronRight, Hotel, Plus, Sparkles } from 'lucide-react';

import type { LogisticsAccounts } from '../../../../../../lib/logistics-accounts';
import { nightsOf, uncoveredNights, type HotelAlert } from '../../../../../../lib/logistics/hotel-rules';
import { hotelApi } from './api';
import { buildBoard, statusLabel, type BoardView, type HotelView } from './model';
import { Button, Chip, Ring, SPRING, cx, day, eur, eur0, range, type Tone } from './primitives';
import HotelSheet, { type SheetTab } from './HotelSheet';
import QuotesPanel from './QuotesPanel';

export type Notify = (message: string, tone?: 'ok' | 'error') => void;

const alertTone = (alert: HotelAlert | null): Tone =>
    !alert ? 'neutral' : alert.level === 'alert' ? 'late' : alert.level === 'waiting' ? 'soon' : 'neutral';

export default function HotelsBoard({
    accounts, pilgrimageId, onChanged, error,
}: {
    accounts: LogisticsAccounts | null;
    pilgrimageId: string;
    onChanged: () => Promise<void> | void;
    error?: string | null;
}) {
    const [open, setOpen] = useState<{ id: string; tab: SheetTab } | null>(null);
    const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'error'; key: number } | null>(null);
    const api = useMemo(() => hotelApi(pilgrimageId), [pilgrimageId]);
    const board = useMemo<BoardView | null>(() => (accounts ? buildBoard(accounts) : null), [accounts]);

    // O hotel aberto fica no endereço (?hotel=), para voltar ou partilhar.
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('hotel');
        if (id) setOpen({ id, tab: 'conta' });
    }, []);
    useEffect(() => {
        const url = new URL(window.location.href);
        if (open) url.searchParams.set('hotel', open.id); else url.searchParams.delete('hotel');
        window.history.replaceState(null, '', url.toString());
    }, [open]);

    const notify: Notify = useCallback((message, tone = 'ok') => setToast({ message, tone, key: Date.now() }), []);
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(timer);
    }, [toast]);

    const addHotel = async () => {
        const stays = accounts?.stays ?? [];
        const last = [...stays].sort((a, b) => b.checkOut.localeCompare(a.checkOut))[0];
        const start = last?.checkOut || accounts?.pilgrimage.startDate || new Date().toISOString().slice(0, 10);
        const end = addDays(start, 1);
        try {
            const created = await api.createStay({
                hotel: '', city: '', check_in: start, check_out: end, board: 'Meia pensão', status: 'idea',
                shared_price_per_night: 0, single_supplement_per_night: 0, city_tax_per_person_night: 0,
                free_per_n: 0, paid_amount: 0, display_order: stays.length + 1,
            });
            await onChanged();
            setOpen({ id: created.id, tab: 'detalhes' });
        } catch (err) {
            notify(err instanceof Error ? err.message : 'Não foi possível criar o hotel.', 'error');
        }
    };

    if (error) return <Empty title="Não foi possível carregar os hotéis" detail={error} />;
    if (!accounts || !board) return <Empty title="A carregar os hotéis…" detail="A ler estadias, prestações e acordos." />;

    const current = open ? board.hotels.find(h => h.stay.id === open.id) ?? null : null;
    const next = current ? board.hotels.find(h => h.index === current.index + 1) ?? null : null;

    return (
        <>
            <div className="hg-canvas -mx-2 rounded-[32px] p-3 sm:p-5 md:p-6">
                <div className="space-y-5">
                    <Summary board={board} onOpen={(id, tab) => setOpen({ id, tab })} />
                    <Itinerary board={board} start={accounts.pilgrimage.startDate} end={accounts.pilgrimage.endDate} onOpen={id => setOpen({ id, tab: 'conta' })} />

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <section>
                            <div className="mb-3 flex items-center justify-between gap-3 px-1">
                                <h3 className="text-[15px] font-semibold text-zinc-900">Hotéis <span className="font-normal text-zinc-400">· {board.hotels.length}</span></h3>
                                <Button variant="primary" onClick={() => void addHotel()}><Plus className="h-4 w-4" /> Hotel</Button>
                            </div>
                            {board.hotels.length === 0 ? (
                                <Empty title="Ainda não há hotéis" detail="Adicione o primeiro e copie a proforma linha a linha." />
                            ) : (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {board.hotels.map(h => (
                                        <HotelCard key={h.stay.id} view={h} onOpen={() => setOpen({ id: h.stay.id, tab: 'conta' })} />
                                    ))}
                                </div>
                            )}
                        </section>
                        <PaymentsRail board={board} onOpen={id => setOpen({ id, tab: 'pagamentos' })} />
                    </div>

                    <QuotesPanel quotes={accounts.quotes} api={api} onChanged={onChanged} notify={notify} />
                </div>
            </div>

            <AnimatePresence>
                {current && open && (
                    <HotelSheet
                        key={current.stay.id}
                        view={current}
                        next={next}
                        tab={open.tab}
                        onTab={tab => setOpen({ id: current.stay.id, tab })}
                        pilgrimageId={pilgrimageId}
                        api={api}
                        onChanged={onChanged}
                        notify={notify}
                        onClose={() => setOpen(null)}
                        roomMix={accounts.roomMix}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {toast && (
                    <motion.div
                        key={toast.key}
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={SPRING}
                        role="status"
                        className={cx('fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full px-4 py-2.5 text-[13.5px] font-medium shadow-xl',
                            toast.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-white')}
                    >
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// ---------------------------------------------------------------------------

function Summary({ board, onOpen }: { board: BoardView; onOpen: (id: string, tab: SheetTab) => void }) {
    const { totals } = board;
    const share = totals.transfer > 0 ? totals.paid / totals.transfer : 0;
    const urgent = board.alerts.filter(a => a.level !== 'neutral');
    const other = board.alerts.filter(a => a.level === 'neutral');
    return (
        <section className="hg-glass rounded-[28px] p-5 md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Ring share={share} size={64} tone={totals.overdue > 0 ? 'late' : 'neutral'} />
                    <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-zinc-400">Pago aos hotéis</p>
                        <p className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900 tabular-nums">
                            {eur0(totals.paid)} <span className="text-[16px] font-normal text-zinc-400">de {eur0(totals.transfer)}</span>
                        </p>
                        {totals.onSite > 0 && <p className="text-[12.5px] text-zinc-500">+ {eur(totals.onSite)} a pagar no hotel, à chegada</p>}
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <Figure label="Falta transferir" value={eur0(totals.left)} />
                    <Figure label="Próximos 7 dias" value={eur0(totals.dueSoon)} tone={totals.dueSoon > 0 ? 'soon' : 'neutral'} />
                    <Figure label="Em atraso" value={eur0(totals.overdue)} tone={totals.overdue > 0 ? 'late' : 'neutral'} />
                </div>
            </div>

            {board.alerts.length > 0 ? (
                <div className="mt-5 space-y-1.5 border-t border-zinc-900/[0.06] pt-4">
                    {[...urgent, ...other].slice(0, 8).map((alert, i) => (
                        <button
                            key={`${alert.kind}-${alert.stayId}-${i}`}
                            type="button"
                            disabled={!alert.stayId}
                            onClick={() => alert.stayId && onOpen(alert.stayId, tabForAlert(alert))}
                            className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors duration-150 hover:bg-white/70 disabled:hover:bg-transparent"
                        >
                            <Chip tone={alertTone(alert)} dot>{alert.level === 'alert' ? 'Urgente' : alert.level === 'waiting' ? 'Em breve' : 'Rever'}</Chip>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium text-zinc-900">{alert.title}</span>
                                <span className="block truncate text-[12.5px] text-zinc-500">{alert.detail}</span>
                            </span>
                            {alert.stayId && <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-zinc-500" />}
                        </button>
                    ))}
                    {board.alerts.length > 8 && <p className="px-3 text-[12.5px] text-zinc-400">+ {board.alerts.length - 8} avisos nos cartões</p>}
                </div>
            ) : (
                <p className="mt-5 flex items-center gap-2 border-t border-zinc-900/[0.06] pt-4 text-[13.5px] text-zinc-500">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Nada a tratar. Os prazos avisam aqui 7 dias antes.
                </p>
            )}
        </section>
    );
}

const tabForAlert = (alert: HotelAlert): SheetTab =>
    alert.kind === 'overdue' || alert.kind === 'due_soon' || alert.kind === 'schedule_mismatch' || alert.kind === 'no_schedule' ? 'pagamentos'
        : alert.kind === 'lines_mismatch' ? 'conta'
            : alert.kind === 'no_proforma' || alert.kind === 'no_final_invoice' ? 'acordo'
                : 'detalhes';

function Figure({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: Tone }) {
    return (
        <div className="hg-well rounded-2xl px-3 py-2.5 sm:px-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</p>
            <p className={cx('mt-0.5 text-[17px] font-semibold tabular-nums tracking-tight',
                tone === 'late' ? 'text-rose-600' : tone === 'soon' ? 'text-amber-600' : 'text-zinc-900')}>{value}</p>
        </div>
    );
}

// ---------------------------------------------------------------------------

function Itinerary({ board, start, end, onOpen }: { board: BoardView; start: string | null; end: string | null; onOpen: (id: string) => void }) {
    const stays = board.hotels.map(h => h.stay);
    const first = start || stays.map(s => s.checkIn).sort()[0];
    const last = end || stays.map(s => s.checkOut).sort().slice(-1)[0];
    if (!first || !last) return null;
    const nights = nightsOf(first, last);
    if (!nights.length || nights.length > 45) return null;
    const gaps = new Set(uncoveredNights(stays, first, last));
    const col = (iso: string) => nights.indexOf(iso) + 1;

    return (
        <section className="hg-glass overflow-x-auto rounded-[28px] p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-900"><BedDouble className="h-4 w-4 text-zinc-400" /> Noites</h3>
                {gaps.size > 0 && <Chip tone="soon">{gaps.size} {gaps.size === 1 ? 'noite sem hotel' : 'noites sem hotel'}</Chip>}
            </div>
            <div className="grid min-w-[560px] gap-1.5" style={{ gridTemplateColumns: `repeat(${nights.length}, minmax(0, 1fr))` }}>
                {nights.map(night => (
                    <div key={night} className="text-center text-[11px] font-medium tabular-nums text-zinc-400">{day(night)}</div>
                ))}
                {board.hotels.map(h => {
                    const from = col(h.stay.checkIn);
                    const span = nightsOf(h.stay.checkIn, h.stay.checkOut).filter(n => nights.includes(n)).length;
                    if (from < 1 || span < 1) return null;
                    const tone = alertTone(h.headline);
                    return (
                        <motion.button
                            key={h.stay.id}
                            type="button"
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            transition={SPRING}
                            onClick={() => onOpen(h.stay.id)}
                            style={{ gridColumn: `${from} / span ${span}` }}
                            className={cx('hg-pill flex h-11 min-w-0 items-center gap-2 rounded-2xl px-3 text-left',
                                h.paidShare >= 0.999 && 'ring-1 ring-emerald-500/30', tone === 'late' && 'ring-1 ring-rose-500/40', tone === 'soon' && 'ring-1 ring-amber-500/40')}
                        >
                            <span className={cx('h-2 w-2 shrink-0 rounded-full', h.paidShare >= 0.999 ? 'bg-emerald-500' : tone === 'late' ? 'bg-rose-500' : tone === 'soon' ? 'bg-amber-500' : 'bg-zinc-300')} />
                            <span className="min-w-0">
                                <span className="block truncate text-[12.5px] font-semibold text-zinc-900">{h.stay.hotel || 'Sem nome'}</span>
                                <span className="block truncate text-[11px] text-zinc-500">{h.stay.city || statusLabel(h.stay.status)}</span>
                            </span>
                        </motion.button>
                    );
                })}
                {[...gaps].map(night => (
                    <div key={`gap-${night}`} style={{ gridColumn: `${col(night)} / span 1` }}
                        className="flex h-11 items-center justify-center rounded-2xl border border-dashed border-amber-400/70 text-[11px] font-medium text-amber-700">
                        sem hotel
                    </div>
                ))}
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------

function HotelCard({ view, onOpen }: { view: HotelView; onOpen: () => void }) {
    const { stay, cost, schedule, headline } = view;
    const tone = alertTone(headline);
    const nights = cost.nights;
    return (
        <motion.button
            type="button"
            onClick={onOpen}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            transition={SPRING}
            className="hg-glass flex w-full flex-col gap-4 rounded-[26px] p-4 text-left md:p-5"
        >
            <div className="flex w-full items-start gap-3">
                <span className="hg-thumb flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold tabular-nums text-zinc-500">{view.index}</span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-semibold text-zinc-900">{stay.hotel || 'Hotel sem nome'}</p>
                    <p className="truncate text-[13px] text-zinc-500">
                        {[stay.city, `${range(stay.checkIn, stay.checkOut)} · ${nights} ${nights === 1 ? 'noite' : 'noites'}`].filter(Boolean).join(' · ')}
                    </p>
                </div>
                <Chip tone={stay.status === 'confirmed' || stay.status === 'paid' ? 'ok' : stay.status === 'prebooked' ? 'info' : 'neutral'}>{statusLabel(stay.status)}</Chip>
            </div>

            <div className="flex w-full items-center gap-3">
                <Ring share={view.paidShare} tone={tone} />
                <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-zinc-600">
                        <span className="font-semibold tabular-nums text-zinc-900">{eur0(stay.paidAmount)}</span> de {eur0(cost.transferTotal)}
                    </p>
                    <p className="truncate text-[12.5px] text-zinc-500">
                        {cost.fromProforma ? 'Proforma' : cost.fromLines ? 'Linhas da proforma' : 'Estimativa pela fórmula'}
                        {cost.onSite > 0 && ` · + ${eur0(cost.onSite)} no hotel`}
                    </p>
                </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2">
                {schedule.next ? (
                    <Chip tone={schedule.next.state === 'overdue' ? 'late' : schedule.next.state === 'due_soon' ? 'soon' : 'neutral'}>
                        <CalendarClock className="h-3 w-3" /> {schedule.next.label || 'Prestação'} · {eur0(schedule.next.left)} · {day(schedule.next.dueDate)}
                    </Chip>
                ) : schedule.items.length > 0 ? (
                    <Chip tone="ok">Prestações pagas</Chip>
                ) : null}
                {headline && headline.kind !== 'overdue' && headline.kind !== 'due_soon' && (
                    <Chip tone={tone === 'neutral' ? 'neutral' : tone} className="max-w-full truncate">
                        {headline.level === 'neutral' ? <Sparkles className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {headline.title.replace(`${stay.hotel}: `, '')}
                    </Chip>
                )}
            </div>
        </motion.button>
    );
}

// ---------------------------------------------------------------------------

function PaymentsRail({ board, onOpen }: { board: BoardView; onOpen: (stayId: string) => void }) {
    const [showPaid, setShowPaid] = useState(false);
    const open = board.installments.filter(i => i.state !== 'paid');
    const paid = board.installments.filter(i => i.state === 'paid');
    return (
        <aside className="hg-glass h-fit rounded-[28px] p-4 md:p-5">
            <h3 className="mb-1 flex items-center gap-2 px-1 text-[15px] font-semibold text-zinc-900"><CalendarClock className="h-4 w-4 text-zinc-400" /> Prestações</h3>
            <p className="mb-3 px-1 text-[12.5px] text-zinc-500">O pago vem do banco, pela Contabilidade.</p>
            {board.installments.length === 0 ? (
                <p className="hg-well rounded-2xl px-4 py-5 text-center text-[13px] text-zinc-500">Ainda sem prestações. Abra um hotel › Pagamentos.</p>
            ) : (
                <ul className="space-y-1">
                    {open.map(item => (
                        <li key={item.id}>
                            <button type="button" onClick={() => onOpen(item.stayId)}
                                className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-white/70">
                                <span className={cx('flex w-12 shrink-0 flex-col items-center rounded-xl py-1 text-center',
                                    item.state === 'overdue' ? 'bg-rose-500/10 text-rose-700' : item.state === 'due_soon' ? 'bg-amber-500/12 text-amber-700' : 'hg-well text-zinc-600')}>
                                    <span className="text-[15px] font-semibold leading-none tabular-nums">{Number(item.dueDate.slice(8))}</span>
                                    <span className="text-[10.5px] uppercase">{day(item.dueDate).split(' ')[1]}</span>
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13.5px] font-medium text-zinc-900">{item.hotel || 'Sem nome'}</span>
                                    <span className="block truncate text-[12px] text-zinc-500">
                                        {item.label || 'Prestação'} · {item.state === 'overdue' ? `atraso ${-item.daysLeft} d` : item.daysLeft === 0 ? 'hoje' : `em ${item.daysLeft} d`}
                                        {item.paidPart > 0 && ` · ${eur0(item.paidPart)} pagos`}
                                    </span>
                                </span>
                                <span className="text-[13.5px] font-semibold tabular-nums text-zinc-900">{eur0(item.left)}</span>
                            </button>
                        </li>
                    ))}
                    {paid.length > 0 && (
                        <li className="pt-1">
                            <button type="button" onClick={() => setShowPaid(v => !v)} className="px-2.5 text-[12.5px] font-medium text-zinc-500 hover:text-zinc-800">
                                {showPaid ? 'Esconder' : 'Ver'} {paid.length} {paid.length === 1 ? 'paga' : 'pagas'}
                            </button>
                            <AnimatePresence initial={false}>
                                {showPaid && (
                                    <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
                                        {paid.map(item => (
                                            <li key={item.id} className="flex items-center gap-3 px-2.5 py-1.5 text-[12.5px] text-zinc-500">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                <span className="flex-1 truncate">{item.hotel} · {item.label}</span>
                                                <span className="tabular-nums">{eur0(item.amount)}</span>
                                            </li>
                                        ))}
                                    </motion.ul>
                                )}
                            </AnimatePresence>
                        </li>
                    )}
                </ul>
            )}
        </aside>
    );
}

function Empty({ title, detail }: { title: string; detail: string }) {
    return (
        <div className="hg-glass flex flex-col items-center rounded-[28px] px-6 py-12 text-center">
            <span className="hg-thumb mb-3 flex h-11 w-11 items-center justify-center rounded-2xl"><Hotel className="h-5 w-5 text-zinc-500" /></span>
            <p className="text-[15px] font-semibold text-zinc-900">{title}</p>
            <p className="mt-1 max-w-sm text-[13.5px] text-zinc-500">{detail}</p>
        </div>
    );
}

function addDays(iso: string, days: number) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
