"use client";

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Users, Bus, RotateCcw } from 'lucide-react';
import {
    type LogisticsAccounts, stayCostOf, costTotalOf, eur, eur0,
} from '../../../../../../lib/logistics-accounts';
import { Surface, Row, DATA_BLUE, dataBlue, RESULT, EmptyState } from './kit';

/** Lugares por autocarro. Passar disto obriga a contratar outro. */
const BUS_SEATS = 53;

export default function AccountsTab({
    accounts, error,
}: {
    accounts: LogisticsAccounts | null;
    error?: string | null;
}) {
    // Uma fonte só: o servidor calcula a despesa por rubrica e o saldo, para
    // que o Painel e as Contas nunca mostrem números diferentes.
    const cost = accounts?.expenses ?? null;

    // Receita real (bookings + pagamentos verificados). Enquanto a chamada não
    // volta, mostramos vazio em vez de números do Excel — dois números
    // diferentes para a mesma coisa foi exactamente o problema que isto resolve.
    const rev = accounts
        ? {
            paying: accounts.revenue.paying,
            courtesy: accounts.revenue.courtesy,
            held: accounts.revenue.held,
            beds: accounts.revenue.beds,
            expected: accounts.revenue.expected,
            received: accounts.revenue.received,
            outstanding: accounts.revenue.outstanding,
            heldValue: 0,
        }
        : null;

    // ---- Modelo de custos ----------------------------------------------
    // Hotéis e refeições acompanham o número de pessoas; o autocarro é fixo
    // por veículo e só sobe quando é preciso mais um.
    const model = useMemo(() => {
        if (!rev || !cost || rev.paying === 0) return null;
        const currentPax = rev.beds;
        const variablePerPax = (cost.hotels + cost.restaurants) / currentPax;
        const currentBuses = Math.max(1, Math.ceil(currentPax / BUS_SEATS));
        const transportPerBus = cost.transport / currentBuses;
        const avgTicket = rev.expected / rev.paying;

        const at = (pax: number) => {
            const buses = Math.max(1, Math.ceil(pax / BUS_SEATS));
            const transport = transportPerBus * buses;
            const variable = variablePerPax * pax;
            const total = transport + variable;
            const paying = Math.max(0, pax - rev.courtesy);
            const revenue = avgTicket * paying;
            return {
                pax, buses, transport, variable, total, paying, revenue,
                balance: revenue - total,
                perPax: pax > 0 ? total / pax : 0,
                margin: revenue > 0 ? ((revenue - total) / revenue) * 100 : 0,
            };
        };

        // Ponto de equilíbrio com um só autocarro; se passar da lotação, recalcula.
        const breakEvenFor = (buses: number) =>
            Math.ceil((transportPerBus * buses + variablePerPax * rev.courtesy) / (avgTicket - variablePerPax));
        let breakEven = breakEvenFor(1);
        if (breakEven > BUS_SEATS) breakEven = breakEvenFor(Math.ceil(breakEven / BUS_SEATS));

        return { at, avgTicket, variablePerPax, transportPerBus, currentPax, breakEven };
    }, [cost, rev]);

    const [paxOverride, setPaxOverride] = useState<number | null>(null);
    const [showDetail, setShowDetail] = useState(false);

    if (error) {
        return (
            <Surface>
                <EmptyState icon={Users} title="Não foi possível carregar as contas" detail={error} />
            </Surface>
        );
    }
    if (!rev || !cost || !model) {
        return (
            <Surface>
                <EmptyState icon={Users} title="A carregar contas..." detail="A ler inscrições e pagamentos." />
            </Surface>
        );
    }

    const pax = paxOverride ?? model.currentPax;
    const setPax = (v: number) => setPaxOverride(v);

    const now = model.at(model.currentPax);
    const sim = model.at(pax);
    const isSimulating = pax !== model.currentPax;
    const delta = sim.balance - now.balance;

    const expenses = [
        { label: 'Hotéis', value: cost.hotels, detail: `${accounts!.stays.length} estadias` },
        { label: 'Transporte', value: cost.transport, detail: `${now.buses} ${now.buses === 1 ? 'autocarro' : 'autocarros'}` },
        { label: 'Restaurantes', value: cost.restaurants, detail: `${accounts!.costs.filter(c => c.kind === 'restaurant').length} refeições` },
        { label: 'Museus', value: cost.museum, detail: 'entradas' },
        { label: 'Outros', value: cost.other, detail: 'extras' },
    ].filter(l => l.value > 0).sort((a, b) => b.value - a.value);

    return (
        <div className="space-y-8">

            {/* ---- Saldo -------------------------------------------------- */}
            <Surface>
                <div className="px-7 py-7">
                    <div className="flex flex-wrap items-end justify-between gap-6">
                        <div>
                            <div className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-slate-400">
                                Saldo previsto
                            </div>
                            <div
                                className="mt-2 text-[46px] font-bold leading-none tracking-tight tabular-nums"
                                style={{ color: now.balance >= 0 ? RESULT.positive : RESULT.negative }}
                            >
                                {eur0(now.balance)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Margem</div>
                            <div className="mt-2 text-[26px] font-bold leading-none tabular-nums text-slate-900">
                                {now.margin.toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    <div className="mt-7 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                            style={{ width: `${(now.total / now.revenue) * 100}%`, background: DATA_BLUE[1] }}
                            className="h-full"
                        />
                        <div className="w-[2px] flex-shrink-0 bg-white" />
                        <div
                            style={{ width: `${Math.max(0, (now.balance / now.revenue) * 100)}%`, background: RESULT.positive }}
                            className="h-full rounded-r-full"
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
                        <Legend color={DATA_BLUE[1]} label="Despesa" value={eur0(now.total)} />
                        <Legend color={RESULT.positive} label="Fica" value={eur0(now.balance)} />
                        <Legend color="#cbd5e1" label="Receita total" value={eur0(now.revenue)} />
                    </div>
                </div>
            </Surface>

            {/* ---- Simulador ---------------------------------------------- */}
            <Surface
                title="E se o grupo for maior?"
                subtitle="Arraste para prever o saldo com outro número de pessoas"
                action={
                    isSimulating ? (
                        <button
                            onClick={() => setPax(model.currentPax)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            <RotateCcw className="h-3.5 w-3.5" /> Voltar ao atual
                        </button>
                    ) : undefined
                }
            >
                <div className="px-7 py-7">
                    <div className="flex items-baseline gap-3">
                        <span className="text-[40px] font-bold leading-none tabular-nums text-slate-900">{pax}</span>
                        <span className="text-[15px] text-slate-500">pessoas</span>
                        {isSimulating && (
                            <span
                                className="ml-auto text-[15px] font-semibold tabular-nums"
                                style={{ color: delta >= 0 ? RESULT.positive : RESULT.negative }}
                            >
                                {delta >= 0 ? '+' : '−'}{eur0(Math.abs(delta))} face ao atual
                            </span>
                        )}
                    </div>

                    <div className="relative mt-6">
                        <input
                            type="range"
                            min={20}
                            max={120}
                            value={pax}
                            onChange={e => setPax(Number(e.target.value))}
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-600
                                [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none
                                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px]
                                [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-sky-600
                                [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(15,23,42,0.25)]"
                        />
                        <div className="mt-2 flex justify-between text-[12.5px] text-slate-400">
                            <span>20</span>
                            <span>Atual: {model.currentPax}</span>
                            <span>120</span>
                        </div>
                    </div>

                    <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-slate-100 pt-6 lg:grid-cols-4">
                        <Figure label="Receita" value={eur0(sim.revenue)} />
                        <Figure label="Despesa" value={eur0(sim.total)} />
                        <Figure
                            label="Saldo"
                            value={eur0(sim.balance)}
                            color={sim.balance >= 0 ? RESULT.positive : RESULT.negative}
                        />
                        <Figure label="Custo por pessoa" value={eur0(sim.perPax)} />
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-100 pt-5 text-[13.5px] text-slate-500">
                        <span className="inline-flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-400" />
                            Equilíbrio a partir de <strong className="font-semibold text-slate-900">{model.breakEven} pessoas</strong>
                        </span>
                        <span className="inline-flex items-center gap-2">
                            <Bus className="h-4 w-4 text-slate-400" />
                            {sim.buses} {sim.buses === 1 ? 'autocarro' : 'autocarros'} de {BUS_SEATS} lugares
                            {sim.buses > now.buses && (
                                <strong className="font-semibold text-slate-900">
                                    — mais {sim.buses - now.buses} do que hoje
                                </strong>
                            )}
                        </span>
                    </div>
                </div>
            </Surface>

            {/* ---- Receita e despesa -------------------------------------- */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                <Surface title="Receita" subtitle="Lida das inscrições, não de uma folha à parte">
                    <div className="px-6 py-6 space-y-4">
                        <Money label={`${rev.paying} peregrinos a pagar`} value={eur(rev.expected)} strong />
                        <Money label="Já entrou" value={eur(rev.received)} color={RESULT.positive} />
                        <Money label="Por receber" value={eur(rev.outstanding)} />
                        <div className="border-t border-slate-100 pt-4 space-y-4">
                            {rev.held > 0 && (
                                <Money label={`${rev.held} lugares guardados`} value={`+${eur(rev.heldValue)} se confirmarem`} muted />
                            )}
                            <Money label={`${rev.courtesy} cortesias`} value="0 €" muted />
                            <Money label="Preço médio por pessoa" value={eur(model.avgTicket)} muted />
                        </div>
                    </div>
                </Surface>

                <Surface title="Despesa" subtitle="O que a organização paga aos fornecedores">
                    <div className="px-6 py-6 space-y-5">
                        {expenses.map((line, i) => (
                            <div key={line.label}>
                                <div className="mb-2 flex items-baseline justify-between gap-3">
                                    <span className="flex items-center gap-2.5 text-[14px] font-medium text-slate-700">
                                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: dataBlue(i) }} />
                                        {line.label}
                                        <span className="text-[13px] text-slate-400">{line.detail}</span>
                                    </span>
                                    <span className="text-[14px] font-semibold tabular-nums text-slate-900">{eur0(line.value)}</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className="h-full rounded-r-[4px] transition-all duration-500"
                                        style={{ width: `${(line.value / cost.total) * 100}%`, background: dataBlue(i) }}
                                    />
                                </div>
                            </div>
                        ))}
                        <div className="flex items-baseline justify-between border-t border-slate-100 pt-4">
                            <span className="text-[14px] font-semibold text-slate-900">Total</span>
                            <span className="text-[17px] font-bold tabular-nums tracking-tight text-slate-900">{eur(cost.total)}</span>
                        </div>
                        <p className="text-[13px] leading-relaxed text-slate-500">
                            Os voos ficam de fora — cada peregrino compra o seu bilhete.
                        </p>
                    </div>
                </Surface>
            </div>

            {/* ---- Detalhe ------------------------------------------------ */}
            <div>
                <button
                    onClick={() => setShowDetail(v => !v)}
                    className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-500 transition-colors hover:text-slate-900"
                >
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showDetail ? 'rotate-180' : ''}`} />
                    Detalhe linha a linha ({(accounts?.stays.length ?? 0) + (accounts?.costs.filter(c => c.kind !== 'flight').length ?? 0)})
                </button>

                <AnimatePresence initial={false}>
                    {showDetail && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="overflow-hidden"
                        >
                            <Surface className="mt-3">
                                {(accounts?.stays ?? []).map(stay => {
                                    const c = stayCostOf(stay, accounts!.roomMix);
                                    return (
                                        <DetailRow
                                            key={stay.id}
                                            kind="Hotel"
                                            color={dataBlue(expenses.findIndex(e => e.label === 'Hotéis'))}
                                            name={`${stay.hotel || 'Sem nome'} · ${stay.city}`}
                                            note={`${c.nights}n · ${c.pax} pax`}
                                            total={c.total}
                                            paid={stay.paidAmount}
                                        />
                                    );
                                })}
                                {accounts!.costs.filter(c => c.kind !== 'flight').map(c => (
                                    <DetailRow
                                        key={c.id}
                                        kind={c.kind === 'transport' ? 'Transporte' : c.kind === 'museum' ? 'Museu' : c.kind === 'other' ? 'Outro' : 'Restaurante'}
                                        color={dataBlue(expenses.findIndex(e => e.label === (c.kind === 'transport' ? 'Transporte' : 'Restaurantes')))}
                                        name={c.location || 'Sem nome'}
                                        note={c.supplier || 'fornecedor por definir'}
                                        total={costTotalOf(c, rev.beds)}
                                        paid={c.paidAmount}
                                    />
                                ))}
                                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
                                    <span className="text-[13.5px] font-semibold text-slate-500">Total</span>
                                    <span className="text-[17px] font-bold tabular-nums tracking-tight text-slate-900">{eur(cost.total)}</span>
                                </div>
                            </Surface>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: color }} />
            <div>
                <div className="text-[13px] text-slate-500">{label}</div>
                <div className="text-[14.5px] font-semibold tabular-nums text-slate-900">{value}</div>
            </div>
        </div>
    );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div>
            <div className="text-[12.5px] font-semibold text-slate-500">{label}</div>
            <div
                className="mt-1.5 text-[24px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: color || '#0f172a' }}
            >
                {value}
            </div>
        </div>
    );
}

function Money({
    label, value, color, muted, strong,
}: {
    label: string;
    value: string;
    color?: string;
    muted?: boolean;
    strong?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className={`text-[14px] ${muted ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
            <span
                className={`tabular-nums ${strong ? 'text-[17px] font-bold tracking-tight' : 'text-[14.5px] font-semibold'} ${muted ? 'text-slate-400' : 'text-slate-900'
                    }`}
                style={color && !muted ? { color } : undefined}
            >
                {value}
            </span>
        </div>
    );
}

function DetailRow({
    kind, color, name, note, total, paid,
}: {
    kind: string;
    color: string;
    name: string;
    note: string;
    total: number;
    paid: number;
}) {
    const due = total - paid;
    return (
        <Row>
            <div className="flex items-center gap-4 px-5 py-3.5">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: color }} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-semibold text-slate-900">{name}</div>
                    <div className="mt-0.5 text-[13px] text-slate-500">{kind} · {note}</div>
                </div>
                <div className="w-[120px] flex-shrink-0 text-right">
                    <div className="text-[14.5px] font-semibold tabular-nums text-slate-900">{eur(total)}</div>
                    <div className="mt-0.5 text-[13px] tabular-nums text-slate-500">
                        {due <= 0.5 ? 'pago' : `falta ${eur0(due)}`}
                    </div>
                </div>
            </div>
        </Row>
    );
}
