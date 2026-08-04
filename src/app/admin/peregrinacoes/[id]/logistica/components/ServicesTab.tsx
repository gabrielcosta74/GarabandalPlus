"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Utensils, Bus, Plane, Landmark, Plus, Trash2, ChevronDown, Wallet, Coins, Receipt,
} from 'lucide-react';
import {
    type LogisticsAccounts, type CostRow, costTotalOf, eur, eur0,
} from '../../../../../../lib/logistics-accounts';
import { supabaseBrowser } from '../../../../../../lib/supabase-browser';
import StatCard from '../../../../../../components/admin/ui/StatCard';
import {
    Surface, Row, Button, RowAction, TextField, NumberField, DateField, PillSelect,
    Amount, LedgerLine, EditorColumn, EmptyState, ROLE_TONE, dueRole, formatDateShort,
    type PillOption,
} from './kit';

const STATUS_OPTIONS: PillOption<string>[] = [
    { value: 'idea', label: 'A pensar', role: 'neutral' },
    { value: 'requested', label: 'Pedido', role: 'waiting' },
    { value: 'prebooked', label: 'Pré-reserva', role: 'progress' },
    { value: 'confirmed', label: 'Confirmado', role: 'done' },
    { value: 'paid', label: 'Pago', role: 'done' },
];

const GROUPS: {
    kind: CostRow['kind'];
    title: string;
    icon: typeof Utensils;
    perPerson: boolean;
    billable: boolean;
    note?: string;
}[] = [
        { kind: 'restaurant', title: 'Refeições', icon: Utensils, perPerson: true, billable: true },
        { kind: 'transport', title: 'Transporte', icon: Bus, perPerson: false, billable: true },
        { kind: 'museum', title: 'Museus e entradas', icon: Landmark, perPerson: true, billable: true },
        {
            kind: 'flight', title: 'Voos', icon: Plane, perPerson: true, billable: false,
            note: 'Cada peregrino compra o seu bilhete. Fica aqui como registo — não entra nas contas.',
        },
    ];

export default function ServicesTab({
    accounts, pilgrimageId, onChanged, error,
}: {
    accounts: LogisticsAccounts | null;
    pilgrimageId: string;
    onChanged: () => void;
    error?: string | null;
}) {
    const [openId, setOpenId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const beds = accounts?.revenue.beds ?? 0;
    const costs = accounts?.costs ?? [];
    const API = `/api/admin/logistics/${pilgrimageId}/costs`;

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

    const patch = (id: string, changes: Record<string, unknown>) =>
        authed(API, { method: 'PATCH', body: JSON.stringify({ id, ...changes }) });

    const remove = (id: string) => {
        const c = costs.find(x => x.id === id);
        if (!c) return;
        if (!window.confirm(`Apagar "${c.location || 'este serviço'}"?`)) return;
        if (openId === id) setOpenId(null);
        authed(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    };

    const add = (kind: CostRow['kind'], perPerson: boolean) =>
        authed(API, {
            method: 'POST',
            body: JSON.stringify({
                kind, supplier: '', location: '',
                unit_price: 0, pax: perPerson ? null : 1,
                discount: 0, status: 'idea', paid_amount: 0,
                display_order: costs.length + 1,
            }),
        });

    if (error) {
        return <Surface><EmptyState icon={Receipt} title="Não foi possível carregar os serviços" detail={error} /></Surface>;
    }
    if (!accounts) {
        return <Surface><EmptyState icon={Receipt} title="A carregar..." detail="A ler fornecedores." /></Surface>;
    }

    const { total, paid, due } = accounts.services;
    const undecided = costs.filter(c => c.kind !== 'flight' && c.status === 'idea').length;

    return (
        <div className={`space-y-6 transition-opacity ${busy ? 'pointer-events-none opacity-60' : ''}`}>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total dos serviços" value={eur0(total)} detail={`${costs.filter(c => c.kind !== 'flight').length} fornecedores`} icon={Receipt} tone={ROLE_TONE.neutral} />
                <StatCard label="Já pago" value={eur0(paid)} detail={paid === 0 ? 'Ainda nada adiantado' : `${((paid / total) * 100).toFixed(0)}% do total`} icon={Wallet} tone={paid > 0 ? ROLE_TONE.done : ROLE_TONE.neutral} />
                <StatCard label="Falta pagar" value={eur0(due)} detail="Aos restaurantes e transportes" icon={Coins} tone={ROLE_TONE.neutral} />
                <StatCard label="Por decidir" value={String(undecided)} detail={undecided === 0 ? 'Está tudo escolhido' : 'Sem fornecedor fechado'} icon={Utensils} tone={undecided > 0 ? ROLE_TONE.waiting : ROLE_TONE.done} />
            </div>

            {GROUPS.map(group => {
                const items = costs.filter(c => c.kind === group.kind);
                const groupTotal = items.reduce((a, c) => a + costTotalOf(c, beds), 0);

                return (
                    <Surface
                        key={group.kind}
                        title={group.title}
                        subtitle={
                            items.length === 0 ? 'Nada registado'
                                : group.billable ? `${items.length} registos · ${eur(groupTotal)}`
                                    : `${items.length} registos`
                        }
                        action={<Button onClick={() => add(group.kind, group.perPerson)}><Plus className="h-4 w-4" /> Adicionar</Button>}
                    >
                        {group.note && (
                            <p className="border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[13px] text-slate-500">{group.note}</p>
                        )}

                        {items.length === 0 ? (
                            <EmptyState
                                icon={group.icon}
                                title={`Sem ${group.title.toLowerCase()}`}
                                detail="Adicione o primeiro registo."
                                action={<Button onClick={() => add(group.kind, group.perPerson)}><Plus className="h-4 w-4" /> Adicionar</Button>}
                            />
                        ) : (
                            <>
                                {items.map(item => (
                                    <CostRowView
                                        key={item.id}
                                        item={item}
                                        beds={beds}
                                        billable={group.billable}
                                        open={openId === item.id}
                                        onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                                        onChange={changes => patch(item.id, changes)}
                                        onRemove={() => remove(item.id)}
                                    />
                                ))}
                                {group.billable && (
                                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
                                        <span className="text-[13.5px] font-semibold text-slate-500">Total {group.title.toLowerCase()}</span>
                                        <span className="text-[17px] font-bold tabular-nums tracking-tight text-slate-900">{eur(groupTotal)}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </Surface>
                );
            })}
        </div>
    );
}

function CostRowView({
    item, beds, billable, open, onToggle, onChange, onRemove,
}: {
    item: CostRow;
    beds: number;
    billable: boolean;
    open: boolean;
    onToggle: () => void;
    onChange: (changes: Record<string, unknown>) => void;
    onRemove: () => void;
}) {
    const perPerson = item.pax === null;
    const effectivePax = item.pax ?? beds;
    const total = costTotalOf(item, beds);
    const due = total - item.paidAmount;
    const role = dueRole(due, item.dueDate);
    const settled = due <= 0.5;

    return (
        <Row active={open}>
            <div onClick={onToggle} className="flex cursor-pointer items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-semibold text-slate-900">
                        {item.location || <span className="text-slate-400">Sem nome</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-500">
                        <span className={`truncate ${item.supplier ? '' : 'italic text-slate-400'}`}>
                            {item.supplier || 'fornecedor por definir'}
                        </span>
                        {item.date && (<><span className="text-slate-300">·</span><span className="whitespace-nowrap">{formatDateShort(item.date)}</span></>)}
                    </div>
                </div>

                <div className="hidden w-[124px] flex-shrink-0 text-right sm:block">
                    <div className="text-[14px] font-medium tabular-nums text-slate-700">
                        {item.unitPrice > 0 ? eur(item.unitPrice) : '—'}
                    </div>
                    <div className="mt-0.5 text-[13px] text-slate-500">
                        × {effectivePax} pax{perPerson && <span className="text-slate-400"> · auto</span>}
                    </div>
                </div>

                <PillSelect value={item.status} options={STATUS_OPTIONS} onChange={status => onChange({ status })} />

                <div className="w-[124px] flex-shrink-0">
                    {billable
                        ? <Amount value={eur(total)} sub={settled ? 'pago' : `falta ${eur0(due)}`} subRole={role} />
                        : <div className="text-right text-[13px] text-slate-400">fora das contas</div>}
                </div>

                <div className="flex flex-shrink-0 items-center gap-0.5">
                    <RowAction label="Apagar" icon={Trash2} danger onClick={onRemove} />
                    <RowAction label={open ? 'Fechar' : 'Editar'} icon={ChevronDown} onClick={onToggle} />
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
                        <div className="grid grid-cols-1 gap-6 border-t border-slate-200/70 px-5 py-5 lg:grid-cols-3">

                            <EditorColumn title="Serviço">
                                <TextField label="Local / serviço" value={item.location} onCommit={v => onChange({ location: v })} placeholder="Ex: almoço em Assis" />
                                <TextField label="Fornecedor" value={item.supplier} onCommit={v => onChange({ supplier: v })} placeholder="Nome do fornecedor" />
                                <DateField label="Data" value={item.date || ''} onChange={v => onChange({ cost_date: v || null })} placeholder="Sem data" clearable />
                            </EditorColumn>

                            <EditorColumn title="Valores">
                                <div className="grid grid-cols-2 gap-3">
                                    <NumberField label="Preço" hint={perPerson ? 'por pessoa' : 'valor fixo'} value={item.unitPrice} onCommit={v => onChange({ unit_price: v })} suffix="€" step={0.5} />
                                    <NumberField label="Desconto" value={item.discount} onCommit={v => onChange({ discount: v })} suffix="€" step={0.5} />
                                </div>

                                <div>
                                    <span className="mb-1.5 flex items-baseline gap-1.5">
                                        <span className="text-[12.5px] font-semibold text-slate-600">Pessoas</span>
                                        <span className="text-[12px] text-slate-400">{perPerson ? 'segue as inscrições' : 'número fixo'}</span>
                                    </span>
                                    {perPerson ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3">
                                                <span className="flex-1 text-[14px] tabular-nums text-slate-600">{beds}</span>
                                                <span className="text-[13px] text-slate-400">pax</span>
                                            </div>
                                            <Button size="sm" onClick={() => onChange({ pax: beds })}>Fixar</Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <NumberField value={item.pax ?? 0} onCommit={v => onChange({ pax: v })} suffix="pax" />
                                            <Button size="sm" onClick={() => onChange({ pax: null })}>Auto</Button>
                                        </div>
                                    )}
                                </div>

                                <TextField label="Nota" value={item.notes || ''} onCommit={v => onChange({ notes: v })} placeholder="Condições, contactos..." />
                            </EditorColumn>

                            <EditorColumn title="Conta">
                                {billable ? (
                                    <>
                                        <div className="space-y-2">
                                            <LedgerLine label={`${eur(item.unitPrice)} × ${effectivePax} pax`} value={eur(item.unitPrice * effectivePax)} />
                                            {item.discount > 0 && <LedgerLine label="Desconto" value={`−${eur(item.discount)}`} role="done" />}
                                            <LedgerLine label="Total" value={eur(total)} strong />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 pt-4">
                                            <NumberField label="Já pago" hint="sinal ou total" value={item.paidAmount} onCommit={v => onChange({ paid_amount: v })} suffix="€" step={0.5} />
                                            <DateField label="Pagar até" value={item.dueDate || ''} onChange={v => onChange({ due_date: v || null })} placeholder="Sem prazo" clearable />
                                        </div>
                                        <LedgerLine label="Falta pagar" value={eur(due)} role={role} />
                                        {!settled && (
                                            <Button variant="primary" onClick={() => onChange({ paid_amount: total })} className="w-full">
                                                Marcar como pago
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-[13.5px] leading-relaxed text-slate-500">
                                        Este registo não entra no saldo — o bilhete é comprado diretamente por cada peregrino.
                                    </p>
                                )}
                            </EditorColumn>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Row>
    );
}
