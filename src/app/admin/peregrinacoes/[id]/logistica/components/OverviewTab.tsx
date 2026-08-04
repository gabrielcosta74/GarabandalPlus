"use client";

import { Users, Coins, TrendingUp, BedDouble, ArrowRight, Hotel, Utensils, Wallet } from 'lucide-react';
import {
    type LogisticsAccounts, eur, eur0, costTotalOf, stayCostOf,
} from '../../../../../../lib/logistics-accounts';
import StatCard from '../../../../../../components/admin/ui/StatCard';
import { Surface, Row, EmptyState, ROLE_TONE, RESULT, DATA_BLUE, dataBlue, type Role } from './kit';

export default function OverviewTab({
    accounts, onNavigate, error,
}: {
    accounts: LogisticsAccounts | null;
    onNavigate: (tab: string) => void;
    error?: string | null;
}) {
    if (error) {
        return <Surface><EmptyState icon={Users} title="Não foi possível carregar o painel" detail={error} /></Surface>;
    }
    if (!accounts) {
        return <Surface><EmptyState icon={Users} title="A carregar..." detail="A ler inscrições, quartos e fornecedores." /></Surface>;
    }

    const { revenue, expenses, balance, rooms, people, stays, costs, roomMix } = accounts;
    const beds = revenue.beds;

    // ---- Alertas: só o que exige uma decisão -----------------------------
    const assigned = new Set(rooms.flatMap(r => r.memberIds));
    const unassigned = people.filter(p => !assigned.has(p.id));
    const overfilled = rooms.filter(r => r.memberIds.length > r.capacity);
    const incomplete = rooms.filter(r => r.memberIds.length > 0 && r.memberIds.length < r.capacity);
    const nothingPaid = people.filter(p => p.kind === 'pilgrim' && p.paidAmount <= 0.005 && p.totalAmount > 0);
    const openStays = stays.filter(s => s.status === 'idea' || s.status === 'requested');
    const openCosts = costs.filter(c => c.kind !== 'flight' && c.status === 'idea');
    const overdue = [
        ...stays.filter(s => s.dueDate && stayCostOf(s, roomMix).due > 0.5 && new Date(s.dueDate) < new Date()),
        ...costs.filter(c => c.dueDate && costTotalOf(c, beds) - c.paidAmount > 0.5 && new Date(c.dueDate) < new Date()),
    ];

    const alerts: { role: Role; title: string; detail: string; tab: string; action: string }[] = [];

    if (overdue.length) alerts.push({
        role: 'alert',
        title: `${overdue.length} ${overdue.length === 1 ? 'pagamento com prazo ultrapassado' : 'pagamentos com prazo ultrapassado'}`,
        detail: overdue.map((x: any) => x.hotel || x.location).join(', '),
        tab: 'hotels', action: 'Ver',
    });
    if (overfilled.length) alerts.push({
        role: 'alert',
        title: `${overfilled.length} ${overfilled.length === 1 ? 'quarto com pessoas a mais' : 'quartos com pessoas a mais'}`,
        detail: overfilled.map(r => `${r.label} (${r.memberIds.length}/${r.capacity})`).join(', '),
        tab: 'rooms', action: 'Resolver',
    });
    if (unassigned.length) alerts.push({
        role: 'waiting',
        title: `${unassigned.length} ${unassigned.length === 1 ? 'pessoa sem quarto' : 'pessoas sem quarto'}`,
        detail: rooms.length === 0
            ? 'A planta ainda está vazia — dá para gerar a partir das inscrições.'
            : unassigned.slice(0, 6).map(p => p.name.split(' ')[0]).join(', ') + (unassigned.length > 6 ? '…' : ''),
        tab: 'rooms', action: rooms.length === 0 ? 'Gerar planta' : 'Atribuir',
    });
    if (nothingPaid.length) alerts.push({
        role: 'waiting',
        title: `${nothingPaid.length} pessoas ainda não pagaram nada`,
        detail: `${eur0(nothingPaid.reduce((a, p) => a + p.totalAmount, 0))} por cobrar`,
        tab: 'collections', action: 'Ver cobranças',
    });
    if (revenue.awaitingValidation > 0) alerts.push({
        role: 'progress',
        title: `${eur0(revenue.awaitingValidation)} em comprovativos por validar`,
        detail: 'Entram na receita assim que forem aprovados nas Inscrições.',
        tab: 'collections', action: 'Ver',
    });
    if (openStays.length) alerts.push({
        role: 'waiting',
        title: `${openStays.length} ${openStays.length === 1 ? 'estadia sem reserva fechada' : 'estadias sem reserva fechada'}`,
        detail: openStays.map(s => s.hotel || 'sem nome').join(', '),
        tab: 'hotels', action: 'Ver hotéis',
    });
    if (openCosts.length) alerts.push({
        role: 'neutral',
        title: `${openCosts.length} ${openCosts.length === 1 ? 'serviço sem fornecedor' : 'serviços sem fornecedor'}`,
        detail: openCosts.map(c => c.location || 'sem nome').join(', '),
        tab: 'services', action: 'Ver serviços',
    });
    if (incomplete.length) alerts.push({
        role: 'neutral',
        title: `${incomplete.length} quartos por completar`,
        detail: incomplete.map(r => r.label).join(', '),
        tab: 'rooms', action: 'Ver',
    });

    const breakdown = [
        { label: 'Hotéis', value: expenses.hotels },
        { label: 'Transporte', value: expenses.transport },
        { label: 'Restaurantes', value: expenses.restaurants },
        { label: 'Museus', value: expenses.museum },
        { label: 'Outros', value: expenses.other },
    ].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    return (
        <div className="space-y-6">

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Camas ocupadas"
                    value={`${beds} / ${accounts.pilgrimage.totalVacancies}`}
                    detail={`${revenue.paying} inscritos · ${revenue.courtesy} cortesias${revenue.held ? ` · ${revenue.held} guardados` : ''}`}
                    icon={Users}
                    tone={ROLE_TONE.neutral}
                />
                <StatCard
                    label="Já recebido"
                    value={eur0(revenue.received)}
                    detail={`${((revenue.received / revenue.expected) * 100).toFixed(1)}% de ${eur0(revenue.expected)}`}
                    icon={Coins}
                    tone={ROLE_TONE.done}
                />
                <StatCard
                    label="Despesa"
                    value={eur0(expenses.total)}
                    detail={`${eur0(balance.perPax)} por pessoa · ${eur0(expenses.due)} por pagar`}
                    icon={Wallet}
                    tone={ROLE_TONE.neutral}
                />
                <StatCard
                    label="Saldo previsto"
                    value={eur0(balance.result)}
                    detail={`Margem de ${balance.margin.toFixed(0)}%`}
                    icon={TrendingUp}
                    tone={balance.result >= 0 ? ROLE_TONE.done : ROLE_TONE.alert}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                <div className="lg:col-span-2">
                    <Surface
                        title="Precisa de atenção"
                        subtitle={alerts.length === 0 ? 'Nada por resolver' : `${alerts.length} pontos em aberto`}
                    >
                        {alerts.length === 0 ? (
                            <EmptyState icon={Users} title="Está tudo em ordem" detail="Nenhum quarto, pagamento ou fornecedor por resolver." />
                        ) : alerts.map((alert, i) => (
                            <Row key={i}>
                                <div className="flex items-center gap-4 px-5 py-4">
                                    <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${alert.role === 'alert' ? 'bg-rose-500'
                                        : alert.role === 'waiting' ? 'bg-amber-500'
                                            : alert.role === 'progress' ? 'bg-sky-500' : 'bg-slate-300'
                                        }`} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[14.5px] font-semibold text-slate-900">{alert.title}</div>
                                        <div className="mt-0.5 truncate text-[13px] text-slate-500">{alert.detail}</div>
                                    </div>
                                    <button
                                        onClick={() => onNavigate(alert.tab)}
                                        className="inline-flex flex-shrink-0 items-center gap-1 text-[13px] font-semibold text-slate-500 transition-colors hover:text-slate-900"
                                    >
                                        {alert.action} <ArrowRight className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </Row>
                        ))}
                    </Surface>
                </div>

                <div className="space-y-6">
                    <Surface title="Onde vai o dinheiro" subtitle={eur(expenses.total)}>
                        <div className="space-y-4 px-5 py-5">
                            {breakdown.map((line, i) => (
                                <div key={line.label}>
                                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                                        <span className="flex items-center gap-2 text-[14px] font-medium text-slate-700">
                                            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: dataBlue(i) }} />
                                            {line.label}
                                        </span>
                                        <span className="text-[14px] font-semibold tabular-nums text-slate-900">{eur0(line.value)}</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full rounded-r-[4px] transition-all duration-500"
                                            style={{ width: `${(line.value / expenses.total) * 100}%`, background: dataBlue(i) }}
                                        />
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => onNavigate('accounts')}
                                className="inline-flex items-center gap-1 pt-1 text-[13px] font-semibold text-slate-500 transition-colors hover:text-slate-900"
                            >
                                Ver contas <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </Surface>

                    <Surface title="Estado da operação">
                        <div className="space-y-3 px-5 py-5">
                            <Line icon={BedDouble} label="Quartos na planta" value={String(rooms.length)} onClick={() => onNavigate('rooms')} />
                            <Line icon={Hotel} label="Estadias" value={`${stays.length} · ${eur0(expenses.hotels)}`} onClick={() => onNavigate('hotels')} />
                            <Line icon={Utensils} label="Serviços" value={`${costs.filter(c => c.kind !== 'flight').length} · ${eur0(expenses.total - expenses.hotels)}`} onClick={() => onNavigate('services')} />
                            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                <span className="text-[13.5px] text-slate-500">Tipologia dos quartos</span>
                                <span className="text-[13.5px] font-semibold tabular-nums text-slate-900">
                                    {roomMix.shared} partilhado · {roomMix.single} individual
                                </span>
                            </div>
                        </div>
                    </Surface>

                    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                        <div className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Saldo previsto</div>
                        <div
                            className="mt-2 text-[32px] font-bold leading-none tabular-nums tracking-tight"
                            style={{ color: balance.result >= 0 ? RESULT.positive : RESULT.negative }}
                        >
                            {eur0(balance.result)}
                        </div>
                        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div style={{ width: `${(expenses.total / revenue.expected) * 100}%`, background: DATA_BLUE[1] }} className="h-full" />
                            <div className="w-[2px] flex-shrink-0 bg-white" />
                            <div style={{ width: `${Math.max(0, (balance.result / revenue.expected) * 100)}%`, background: RESULT.positive }} className="h-full rounded-r-full" />
                        </div>
                        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
                            {eur0(revenue.expected)} de receita menos {eur0(expenses.total)} de despesa.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Line({
    icon: Icon, label, value, onClick,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    onClick: () => void;
}) {
    return (
        <button onClick={onClick} className="group flex w-full items-center justify-between gap-3 text-left">
            <span className="flex items-center gap-2.5 text-[13.5px] text-slate-500">
                <Icon className="h-4 w-4 text-slate-400" />
                {label}
            </span>
            <span className="flex items-center gap-1 text-[13.5px] font-semibold tabular-nums text-slate-900">
                {value}
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
            </span>
        </button>
    );
}
