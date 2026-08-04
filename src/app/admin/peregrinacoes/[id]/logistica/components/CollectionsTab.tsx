"use client";

import { useMemo, useState } from 'react';
import { Search, MessageSquarePlus, Award, Lock, HandCoins, Clock, CheckCircle2, Users } from 'lucide-react';
import { type LogisticsAccounts, type LogisticsPerson, eur, eur0 } from '../../../../../../lib/logistics-accounts';
import { supabaseBrowser } from '../../../../../../lib/supabase-browser';
import StatCard from '../../../../../../components/admin/ui/StatCard';
import {
    Surface, Row, EmptyState, Amount, Pill, ROLE_TONE, RESULT, DATA_BLUE, type Role,
} from './kit';

type Filter = 'unpaid' | 'partial' | 'settled' | 'courtesy' | 'all';

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'unpaid', label: 'Nada pago' },
    { id: 'partial', label: 'Pagamento parcial' },
    { id: 'settled', label: 'Liquidados' },
    { id: 'courtesy', label: 'Cortesias' },
    { id: 'all', label: 'Todos' },
];

const stateOf = (p: LogisticsPerson): { role: Role; label: string } => {
    if (p.kind === 'courtesy') return { role: 'special', label: 'Cortesia' };
    if (p.kind === 'held') return { role: 'waiting', label: 'Guardado' };
    if (p.paidAmount >= p.totalAmount - 0.05) return { role: 'done', label: 'Liquidado' };
    if (p.paidAmount > 0) return { role: 'progress', label: 'Parcial' };
    return { role: 'neutral', label: 'Por pagar' };
};

export default function CollectionsTab({
    accounts, pilgrimageId, onChanged, error,
}: {
    accounts: LogisticsAccounts | null;
    pilgrimageId: string;
    onChanged: () => void;
    error?: string | null;
}) {
    const [filter, setFilter] = useState<Filter>('unpaid');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);

    const notes = accounts?.notes ?? {};

    const rows = useMemo(() => {
        if (!accounts) return [];
        return accounts.people.filter((p) => {
            if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
            switch (filter) {
                case 'unpaid': return p.kind === 'pilgrim' && p.paidAmount <= 0.005 && p.totalAmount > 0;
                case 'partial': return p.kind === 'pilgrim' && p.paidAmount > 0 && p.paidAmount < p.totalAmount - 0.05;
                case 'settled': return p.kind === 'pilgrim' && p.totalAmount > 0 && p.paidAmount >= p.totalAmount - 0.05;
                case 'courtesy': return p.kind === 'courtesy';
                default: return true;
            }
        });
    }, [accounts, filter, query]);

    if (error) {
        return <Surface><EmptyState icon={Users} title="Não foi possível carregar as cobranças" detail={error} /></Surface>;
    }
    if (!accounts) {
        return <Surface><EmptyState icon={Users} title="A carregar..." detail="A ler inscrições e pagamentos." /></Surface>;
    }

    const rev = accounts.revenue;
    const nothingPaidValue = accounts.people
        .filter((p) => p.kind === 'pilgrim' && p.paidAmount <= 0.005)
        .reduce((a, p) => a + p.totalAmount, 0);

    const saveNote = async (person: LogisticsPerson) => {
        setEditing(null);
        setBusy(true);
        try {
            const { data } = await supabaseBrowser!.auth.getSession();
            const token = data.session?.access_token;
            const res = await fetch(`/api/admin/logistics/${pilgrimageId}/notes`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    personId: person.id,
                    kind: person.kind === 'pilgrim' ? 'pilgrim' : 'seat',
                    note: draft,
                }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error || 'Erro ao gravar a nota');
            onChanged();
        } catch (err: any) {
            window.alert(err?.message || 'Erro ao gravar a nota');
        } finally {
            setDraft('');
            setBusy(false);
        }
    };

    return (
        <div className={`space-y-6 transition-opacity ${busy ? 'pointer-events-none opacity-60' : ''}`}>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Por receber"
                    value={eur0(rev.outstanding)}
                    detail={`de ${eur0(rev.expected)} · ${((rev.received / rev.expected) * 100).toFixed(1)}% cobrado`}
                    icon={HandCoins}
                    tone={ROLE_TONE.neutral}
                />
                <StatCard
                    label="Já recebido"
                    value={eur0(rev.received)}
                    detail={`${rev.settled} ${rev.settled === 1 ? 'inscrição liquidada' : 'inscrições liquidadas'}`}
                    icon={CheckCircle2}
                    tone={ROLE_TONE.done}
                />
                <StatCard
                    label="Sem pagar nada"
                    value={String(rev.nothingPaid)}
                    detail={`${eur0(nothingPaidValue)} por cobrar`}
                    icon={Users}
                    tone={rev.nothingPaid > 0 ? ROLE_TONE.waiting : ROLE_TONE.done}
                />
                <StatCard
                    label="Por validar"
                    value={eur0(rev.awaitingValidation)}
                    detail={rev.awaitingValidation > 0 ? 'Comprovativos à espera de aprovação' : 'Nada pendente'}
                    icon={Clock}
                    tone={rev.awaitingValidation > 0 ? ROLE_TONE.progress : ROLE_TONE.neutral}
                />
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50 px-5 py-4">
                <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                <div className="text-[13.5px] leading-relaxed text-slate-600">
                    <strong className="font-semibold text-slate-900">Esta página não cobra nem regista pagamentos.</strong>{' '}
                    Os valores vêm das inscrições e dos pagamentos verificados. Para registar um pagamento ou emitir
                    fatura, usa o separador Inscrições da peregrinação. Aqui ficam só as tuas notas de seguimento.
                </div>
            </div>

            <Surface
                title="Seguimento de pagamentos"
                subtitle={`${accounts.revenue.bookings} reservas · ${accounts.revenue.paying} peregrinos`}
            >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center">
                    <div className="flex flex-wrap gap-1.5">
                        {FILTERS.map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${filter === f.id
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 transition-colors focus-within:border-slate-400 focus-within:bg-white lg:w-64">
                        <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Procurar pessoa..."
                            className="w-full bg-transparent text-[14px] outline-none placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {rows.length === 0 ? (
                    <EmptyState icon={Users} title="Ninguém neste filtro" detail="Experimente outro filtro ou limpe a pesquisa." />
                ) : (
                    rows.map((person) => {
                        const state = stateOf(person);
                        const due = Math.max(0, person.totalAmount - person.paidAmount);
                        const pct = person.totalAmount > 0 ? (person.paidAmount / person.totalAmount) * 100 : 0;
                        return (
                            <Row key={person.id}>
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
                                    <div className="min-w-[190px] flex-1">
                                        <div className="flex items-center gap-2">
                                            {person.kind === 'courtesy' && <Award className="h-3.5 w-3.5 flex-shrink-0 text-violet-500" />}
                                            <span className="truncate text-[14.5px] font-semibold text-slate-900">{person.name}</span>
                                        </div>
                                        <div className="mt-0.5 truncate text-[13px] text-slate-500">
                                            {person.kind === 'courtesy'
                                                ? person.role
                                                : [person.email, person.country].filter(Boolean).join(' · ') || '—'}
                                        </div>
                                    </div>

                                    <div className="w-[120px] flex-shrink-0">
                                        {person.kind === 'courtesy' ? (
                                            <div className="text-right text-[13px] text-slate-400">não cobra</div>
                                        ) : (
                                            <>
                                                <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className="h-full rounded-r-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(100, pct)}%`,
                                                            background: pct >= 99.5 ? RESULT.positive : DATA_BLUE[2],
                                                        }}
                                                    />
                                                </div>
                                                <div className="text-[12.5px] tabular-nums text-slate-500">{pct.toFixed(0)}%</div>
                                            </>
                                        )}
                                    </div>

                                    <div className="w-[128px] flex-shrink-0">
                                        <Amount
                                            value={eur(person.totalAmount)}
                                            sub={person.kind === 'courtesy' ? '—' : due <= 0.05 ? 'pago' : `falta ${eur0(due)}`}
                                            subRole={due <= 0.05 ? 'done' : 'neutral'}
                                        />
                                    </div>

                                    <div className="w-[104px] flex-shrink-0">
                                        <Pill role={state.role}>{state.label}</Pill>
                                    </div>

                                    <div className="w-full lg:w-[300px]">
                                        {editing === person.id ? (
                                            <div className="flex gap-2">
                                                <textarea
                                                    autoFocus
                                                    value={draft}
                                                    onChange={(e) => setDraft(e.target.value)}
                                                    rows={2}
                                                    placeholder="Ex: ligou dia 3, paga até ao fim do mês"
                                                    className="flex-1 resize-none rounded-xl border border-slate-300 p-2.5 text-[13px] outline-none focus:border-slate-400"
                                                />
                                                <button
                                                    onClick={() => saveNote(person)}
                                                    className="h-10 flex-shrink-0 rounded-xl bg-slate-900 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
                                                >
                                                    Guardar
                                                </button>
                                            </div>
                                        ) : notes[person.id] || person.notes ? (
                                            <button
                                                onClick={() => { setEditing(person.id); setDraft(notes[person.id] || person.notes || ''); }}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-left text-[13px] text-slate-600 transition-colors hover:border-slate-300"
                                            >
                                                {notes[person.id] || person.notes}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { setEditing(person.id); setDraft(''); }}
                                                className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 transition-colors hover:text-slate-900"
                                            >
                                                <MessageSquarePlus className="h-3.5 w-3.5" /> Escrever nota
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Row>
                        );
                    })
                )}
            </Surface>

        </div>
    );
}
