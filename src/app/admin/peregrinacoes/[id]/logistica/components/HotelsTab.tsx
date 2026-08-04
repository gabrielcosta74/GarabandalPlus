"use client";

import { useState } from 'react';
import { supabaseBrowser } from '../../../../../../lib/supabase-browser';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, ChevronDown, Gift, Hotel as HotelIcon, Wallet, Coins,
} from 'lucide-react';
import {
    type LogisticsAccounts, type HotelStayRow, type LogisticsStatus, type QuoteRow,
    stayCostOf, nightsBetween, eur, eur0, BOARD_OPTIONS,
} from '../../../../../../lib/logistics-accounts';
import StatCard from '../../../../../../components/admin/ui/StatCard';
import {
    Surface, Row, Button, RowAction, TextField, NumberField, DateField, PillSelect,
    Pill, Amount, LedgerLine, EditorColumn, EmptyState, ROLE_TONE, dueRole,
    formatDateShort, type PillOption, type Role,
} from './kit';

const STATUS_OPTIONS: PillOption<LogisticsStatus>[] = [
    { value: 'idea', label: 'A pensar', role: 'neutral' },
    { value: 'requested', label: 'Pedida', role: 'waiting' },
    { value: 'prebooked', label: 'Pré-reserva', role: 'progress' },
    { value: 'confirmed', label: 'Confirmada', role: 'done' },
    { value: 'paid', label: 'Paga', role: 'done' },
];

const QUOTE_OPTIONS: PillOption<string>[] = [
    { value: 'chosen', label: 'Escolhido', role: 'done' },
    { value: 'shortlist', label: 'Em estudo', role: 'progress' },
    { value: 'rejected', label: 'De lado', role: 'neutral' },
];

const BOARD_OPTIONS_PILL: PillOption<string>[] = BOARD_OPTIONS.map(b => ({
    value: b, label: b, role: 'neutral' as Role,
}));

export default function HotelsTab({
    accounts, pilgrimageId, onChanged, error,
}: {
    accounts: LogisticsAccounts | null;
    pilgrimageId: string;
    onChanged: () => void;
    error?: string | null;
}) {
    const [openId, setOpenId] = useState<string | null>(null);
    const [showQuotes, setShowQuotes] = useState(false);
    const [busy, setBusy] = useState(false);

    const stays = accounts?.stays ?? [];
    const quotes = accounts?.quotes ?? [];
    // Tipologia real dos inscritos: é isto que faz o orçamento acompanhar quem
    // muda de partilhado para individual.
    const mix = accounts?.roomMix ?? { shared: 0, single: 0 };
    const stayCost = (stay: HotelStayRow) => stayCostOf(stay, mix);

    const authed = async (path: string, init: RequestInit) => {
        setBusy(true);
        try {
            const { data } = await supabaseBrowser!.auth.getSession();
            const token = data.session?.access_token;
            const res = await fetch(path, {
                ...init,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(init.headers || {}),
                },
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error || 'Erro ao gravar');
            onChanged();
        } catch (err: any) {
            window.alert(err?.message || 'Erro ao gravar');
        } finally {
            setBusy(false);
        }
    };

    const totals = stays.reduce(
        (a, s) => {
            const c = stayCost(s);
            return {
                total: a.total + c.total,
                paid: a.paid + s.paidAmount,
                due: a.due + c.due,
                freeRooms: a.freeRooms + c.freeRooms,
                freeValue: a.freeValue + c.freeValue,
                nights: a.nights + c.nights,
            };
        },
        { total: 0, paid: 0, due: 0, freeRooms: 0, freeValue: 0, nights: 0 },
    );

    const nextDue = stays
        .filter(s => s.dueDate && stayCost(s).due > 0.5)
        .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];

    const API = `/api/admin/logistics/${pilgrimageId}/stays`;
    const QUOTES_API = `/api/admin/logistics/${pilgrimageId}/quotes`;

    const patchQuote = (id: string, changes: Record<string, unknown>) =>
        authed(QUOTES_API, { method: 'PATCH', body: JSON.stringify({ id, ...changes }) });

    const removeQuote = (q: QuoteRow) => {
        if (!window.confirm(`Apagar o orçamento "${q.hotel || 'sem nome'}"?`)) return;
        authed(`${QUOTES_API}?id=${encodeURIComponent(q.id)}`, { method: 'DELETE' });
    };

    const addQuote = () =>
        authed(QUOTES_API, {
            method: 'POST',
            body: JSON.stringify({ city: '', hotel: '', board: 'Meia pensão', status: 'shortlist', display_order: quotes.length + 1 }),
        });

    const patch = (id: string, changes: Record<string, unknown>) =>
        authed(API, { method: 'PATCH', body: JSON.stringify({ id, ...changes }) });

    const remove = (id: string) => {
        const s = stays.find(x => x.id === id);
        if (!s) return;
        if (!window.confirm(`Apagar "${s.hotel || 'esta estadia'}"?`)) return;
        if (openId === id) setOpenId(null);
        authed(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    };

    const add = () => {
        const last = stays[stays.length - 1];
        const start = last ? last.checkOut : '2027-04-05';
        authed(API, {
            method: 'POST',
            body: JSON.stringify({
                hotel: '', city: '',
                check_in: start, check_out: addDays(start, 1),
                board: 'Meia pensão', status: 'idea',
                shared_price_per_night: 0, single_supplement_per_night: 0,
                city_tax_per_person_night: 0, free_per_n: 0, paid_amount: 0,
                display_order: stays.length + 1,
            }),
        });
    };

    if (error) {
        return <Surface><EmptyState icon={HotelIcon} title="Não foi possível carregar os hotéis" detail={error} /></Surface>;
    }
    if (!accounts) {
        return <Surface><EmptyState icon={HotelIcon} title="A carregar..." detail="A ler estadias e inscrições." /></Surface>;
    }

    return (
        <div className={`space-y-6 transition-opacity ${busy ? 'pointer-events-none opacity-60' : ''}`}>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total dos hotéis"
                    value={eur0(totals.total)}
                    detail={`${stays.length} estadias · ${totals.nights} noites`}
                    icon={HotelIcon}
                    tone={ROLE_TONE.neutral}
                />
                <StatCard
                    label="Já pago"
                    value={eur0(totals.paid)}
                    detail={totals.paid === 0 ? 'Ainda nada adiantado' : `${((totals.paid / totals.total) * 100).toFixed(0)}% do total`}
                    icon={Wallet}
                    tone={totals.paid > 0 ? ROLE_TONE.done : ROLE_TONE.neutral}
                />
                <StatCard
                    label="Falta pagar"
                    value={eur0(totals.due)}
                    detail={nextDue ? `Próximo: ${nextDue.hotel || 'sem nome'}, ${formatDateShort(nextDue.dueDate!)}` : 'Nenhum prazo definido'}
                    icon={Coins}
                    tone={ROLE_TONE.neutral}
                />
                <StatCard
                    label="Quartos gratuitos"
                    value={String(totals.freeRooms)}
                    detail={totals.freeRooms > 0 ? `Poupam ${eur(totals.freeValue)}` : 'Nenhum hotel dá gratuitos'}
                    icon={Gift}
                    tone={totals.freeRooms > 0 ? ROLE_TONE.done : ROLE_TONE.neutral}
                />
            </div>

            <Surface
                title="Estadias"
                subtitle="Por ordem de viagem. Clique numa linha para editar."
                action={
                    <Button variant="primary" onClick={add}>
                        <Plus className="h-4 w-4" /> Adicionar hotel
                    </Button>
                }
            >
                {stays.length === 0 ? (
                    <EmptyState
                        icon={HotelIcon}
                        title="Ainda não há hotéis"
                        detail="Adicione a primeira estadia para começar as contas."
                        action={<Button variant="primary" onClick={add}><Plus className="h-4 w-4" /> Adicionar hotel</Button>}
                    />
                ) : (
                    <>
                        {stays.map((stay, i) => (
                            <StayRow
                                key={stay.id}
                                index={i + 1}
                                stay={stay}
                                cost={stayCost(stay)}
                                open={openId === stay.id}
                                onToggle={() => setOpenId(openId === stay.id ? null : stay.id)}
                                onChange={changes => patch(stay.id, changes)}
                                onRemove={() => remove(stay.id)}
                            />
                        ))}
                        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
                            <span className="text-[13.5px] font-semibold text-slate-500">Total</span>
                            <span className="text-[17px] font-bold tabular-nums tracking-tight text-slate-900">
                                {eur(totals.total)}
                            </span>
                        </div>
                    </>
                )}
            </Surface>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                    onClick={() => setShowQuotes(v => !v)}
                    className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-500 transition-colors hover:text-slate-900"
                >
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showQuotes ? 'rotate-180' : ''}`} />
                    Alternativas em estudo ({quotes.length})
                </button>
            </div>

            <AnimatePresence initial={false}>
                {showQuotes && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <Surface
                            title="Alternativas"
                            subtitle="Comparar preços antes de fechar a reserva"
                            action={<Button onClick={addQuote}><Plus className="h-4 w-4" /> Orçamento</Button>}
                        >
                            {quotes.map(q => (
                                <Row key={q.id}>
                                    <div className={`flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 ${q.status === 'rejected' ? 'opacity-45' : ''}`}>
                                        <div className="min-w-[200px] flex-1">
                                            <div className="text-[14.5px] font-semibold text-slate-900">{q.hotel || 'Sem nome'}</div>
                                            <div className="mt-0.5 text-[13px] text-slate-500">
                                                {[q.city, q.board].filter(Boolean).join(' · ')}
                                                {q.notes && <span className="text-slate-400"> · {q.notes}</span>}
                                            </div>
                                        </div>
                                        <Amount value={eur(q.sharedPricePerPerson)} sub="partilhado" />
                                        <div className="w-28"><Amount value={eur(q.singlePricePerPerson)} sub="individual" /></div>
                                        <PillSelect
                                            value={q.status}
                                            options={QUOTE_OPTIONS}
                                            onChange={status => patchQuote(q.id, { status })}
                                            width="w-[128px]"
                                        />
                                        <RowAction label="Apagar orçamento" icon={Trash2} danger onClick={() => removeQuote(q)} />
                                    </div>
                                </Row>
                            ))}
                        </Surface>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ---------------------------------------------------------------------------

function StayRow({
    index, stay, cost: c, open, onToggle, onChange, onRemove,
}: {
    index: number;
    stay: HotelStayRow;
    cost: ReturnType<typeof stayCostOf>;
    open: boolean;
    onToggle: () => void;
    onChange: (changes: Record<string, unknown>) => void;
    onRemove: () => void;
}) {
    const role = dueRole(c.due, stay.dueDate);
    const settled = c.due <= 0.5;

    return (
        <Row active={open}>
            <div onClick={onToggle} className="flex cursor-pointer items-center gap-4 px-5 py-3.5">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[12.5px] font-bold tabular-nums text-slate-500">
                    {index}
                </span>

                <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-semibold text-slate-900">
                        {stay.hotel || <span className="text-slate-400">Hotel sem nome</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-500">
                        <span className="truncate">{stay.city || 'sem cidade'}</span>
                        <span className="text-slate-300">·</span>
                        <span className="truncate">{stay.board}</span>
                        {c.freeRooms > 0 && (
                            <>
                                <span className="text-slate-300">·</span>
                                <span className="whitespace-nowrap font-medium text-emerald-600">{c.freeRooms} grátis</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="hidden w-[132px] flex-shrink-0 text-right sm:block">
                    <div className="text-[14px] font-medium tabular-nums text-slate-700">{dateRange(stay)}</div>
                    <div className="mt-0.5 text-[13px] text-slate-500">
                        {c.nights}{c.nights === 1 ? ' noite' : ' noites'} · {c.pax} pax
                    </div>
                </div>

                <PillSelect value={stay.status as LogisticsStatus} options={STATUS_OPTIONS} onChange={status => onChange({ status })} />

                <div className="w-[124px] flex-shrink-0">
                    <Amount
                        value={eur(c.total)}
                        sub={settled ? 'pago' : `falta ${eur0(c.due)}`}
                        subRole={role}
                    />
                </div>

                <div className="flex flex-shrink-0 items-center gap-0.5">
                    <RowAction label="Apagar estadia" icon={Trash2} danger onClick={onRemove} />
                    <RowAction
                        label={open ? 'Fechar' : 'Editar'}
                        icon={ChevronDown}
                        onClick={onToggle}
                    />
                </div>
            </div>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 gap-6 border-t border-slate-200/70 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,0.95fr)]">

                            <EditorColumn title="Estadia">
                                <TextField label="Hotel" value={stay.hotel} onCommit={v => onChange({ hotel: v })} placeholder="Nome do hotel" />
                                <TextField label="Cidade" value={stay.city} onCommit={v => onChange({ city: v })} placeholder="Cidade" />
                                <div className="grid grid-cols-2 gap-3">
                                    <DateField label="Entrada" value={stay.checkIn} onChange={v => onChange({ check_in: v })} />
                                    <DateField label="Saída" value={stay.checkOut} onChange={v => onChange({ check_out: v })} />
                                </div>
                                <div>
                                    <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-600">Regime</span>
                                    <PillSelect
                                        value={stay.board}
                                        options={BOARD_OPTIONS_PILL}
                                        onChange={board => onChange({ board })}
                                        width="w-full max-w-[200px]"
                                    />
                                </div>
                                <TextField
                                    label="Nota"
                                    value={stay.notes || ''}
                                    onCommit={v => onChange({ notes: v })}
                                    placeholder="O que falta confirmar..."
                                />
                            </EditorColumn>

                            <EditorColumn title="Preços">
                                <div className="grid grid-cols-2 gap-3">
                                    <NumberField label="Partilhado" hint="por pessoa/noite" value={stay.sharedPricePerNight} onCommit={v => onChange({ shared_price_per_night: v })} suffix="€" step={0.5} />
                                    <NumberField label="Supl. individual" hint="por noite" value={stay.singleSupplementPerNight} onCommit={v => onChange({ single_supplement_per_night: v })} suffix="€" step={0.5} />
                                    <ReadOnlyField label="Em partilhado" hint="das inscrições" value={`${c.pax - (stay.paxSingle ?? 0) - (stay.paxShared === null ? 0 : 0)}`.replace(/^\d+$/, String(stay.paxShared ?? (c.pax - (stay.paxSingle ?? 0))))} suffix="pax" />
                                    <ReadOnlyField label="Em individual" hint="das inscrições" value={String(stay.paxSingle ?? 0)} suffix="pax" />
                                    <NumberField label="Taxa turística" hint="pessoa/noite" value={stay.cityTaxPerPersonNight} onCommit={v => onChange({ city_tax_per_person_night: v })} suffix="€" step={0.5} />
                                    <NumberField label="Grátis 1 em cada" hint="0 = não tem" value={stay.freePerN} onCommit={v => onChange({ free_per_n: v })} suffix="pax" />
                                </div>
                            </EditorColumn>

                            <EditorColumn title="Conta">
                                <div className="space-y-2">
                                    <LedgerLine label={`Alojamento · ${c.pax} pax × ${c.nights}n`} value={eur(c.accommodation)} />
                                    {c.cityTax > 0 && <LedgerLine label="Taxa turística" value={eur(c.cityTax)} />}
                                    {c.freeRooms > 0 && (
                                        <LedgerLine
                                            label={`${c.freeRooms} ${c.freeRooms === 1 ? 'quarto grátis' : 'quartos grátis'} (1 em cada ${stay.freePerN})`}
                                            value={`−${eur(c.freeValue)}`}
                                            role="done"
                                        />
                                    )}
                                    <LedgerLine label="Total" value={eur(c.total)} strong />
                                </div>

                                <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 pt-4">
                                    <NumberField label="Já pago" hint="sinal ou total" value={stay.paidAmount} onCommit={v => onChange({ paid_amount: v })} suffix="€" step={0.5} />
                                    <DateField
                                        label="Pagar até"
                                        value={stay.dueDate || ''}
                                        onChange={v => onChange({ due_date: v || null })}
                                        placeholder="Sem prazo"
                                        clearable
                                    />
                                </div>

                                <LedgerLine label="Falta pagar" value={eur(c.due)} role={role} />

                                {!settled && (
                                    <Button variant="primary" onClick={() => onChange({ paid_amount: c.total })} className="w-full">
                                        Marcar como pago
                                    </Button>
                                )}
                            </EditorColumn>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Row>
    );
}

// ---------------------------------------------------------------------------

function ReadOnlyField({ label, hint, value, suffix }: { label: string; hint: string; value: string; suffix: string }) {
    return (
        <div>
            <span className="mb-1.5 flex items-baseline gap-1.5">
                <span className="text-[12.5px] font-semibold text-slate-600">{label}</span>
                <span className="text-[12px] text-slate-400">{hint}</span>
            </span>
            <div className="flex h-10 items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3">
                <span className="flex-1 text-[14px] tabular-nums text-slate-600">{value}</span>
                <span className="text-[13px] text-slate-400">{suffix}</span>
            </div>
        </div>
    );
}

function addDays(iso: string, days: number) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function dateRange(stay: HotelStayRow) {
    const a = new Date(stay.checkIn + 'T00:00:00');
    const b = new Date(stay.checkOut + 'T00:00:00');
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '—';
    return a.getMonth() === b.getMonth()
        ? `${a.getDate()} → ${b.getDate()} ${MONTHS[b.getMonth()]}`
        : `${a.getDate()} ${MONTHS[a.getMonth()]} → ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}
