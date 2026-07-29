"use client";
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState } from 'react';
import {
    X,
    Copy,
    Check,
    FileText,
    Package,
    Heart,
    Plane,
    Users,
    CreditCard
} from 'lucide-react';

export type TransactionDetail = {
    id: string;
    category: 'shop' | 'donation' | 'quota' | 'pilgrimage';
    reference: string;
    amount: number;
    currency: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_nif?: string | null;
    customer_address?: string | null;
    customer_city?: string | null;
    customer_zip?: string | null;
    customer_country?: string | null;
    status: string;
    method: string | null;
    provider: string | null;
    created_at: string;
    items?: Array<{ name: string; qty: number; price: number; total: number }>;
    notes?: string;
    proof_url?: string;
    subject?: string | null;
    subject_detail?: string | null;
    external_reference?: string | null;
    gateway_transaction_id?: string | null;
    payment_token?: string | null;
    charged_amount?: number | null;
    gateway_description?: string | null;
    date_is_approximate?: boolean;
};

type TransactionDetailsModalProps = {
    transaction: TransactionDetail;
    onClose: () => void;
};

const CATEGORY_META = {
    shop: { label: 'Loja Online', Icon: Package, tone: 'bg-violet-50 text-violet-600' },
    donation: { label: 'Doação', Icon: Heart, tone: 'bg-rose-50 text-rose-600' },
    pilgrimage: { label: 'Peregrinação', Icon: Plane, tone: 'bg-amber-50 text-amber-600' },
    quota: { label: 'Quota de Membro', Icon: Users, tone: 'bg-teal-50 text-teal-600' },
} as const;

const PAID = ['paid', 'pago', 'succeeded', 'verified'];
const PENDING = ['pending', 'pendente', 'verifying', 'pending_verification'];

export default function TransactionDetailsModal({ transaction, onClose }: TransactionDetailsModalProps) {
    const [copied, setCopied] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 1600);
    };

    const formatCurrency = (val: number, cur: string) =>
        new Intl.NumberFormat('pt-PT', { style: 'currency', currency: cur }).format(val);

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('pt-PT', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

    const status = transaction.status?.toLowerCase() || '';
    const statusTone = PAID.includes(status)
        ? 'bg-emerald-50 text-emerald-700'
        : PENDING.includes(status)
            ? 'bg-amber-50 text-amber-700'
            : 'bg-slate-100 text-slate-600';

    const meta = CATEGORY_META[transaction.category] || { label: 'Transação', Icon: CreditCard, tone: 'bg-slate-100 text-slate-600' };
    const chargedDiffers = typeof transaction.charged_amount === 'number'
        && Math.abs(transaction.charged_amount - transaction.amount) >= 0.01;

    const copyBillingInfo = () => {
        const lines = [
            `Nome: ${transaction.customer_name || ''}`,
            `NIF: ${transaction.customer_nif || 'N/A'}`,
            `Email: ${transaction.customer_email || ''}`,
            `Morada: ${transaction.customer_address || ''}`,
            `${transaction.customer_zip || ''} ${transaction.customer_city || ''}`,
            `${transaction.customer_country || ''}`
        ].filter(l => l.trim().replace(/^[^:]+:$/, '') !== '');

        handleCopy(lines.join('\n'), 'billing');
    };

    return (
        <Transition appear show as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
                    leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-[2px]" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200" enterFrom="opacity-0 scale-[0.98]" enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-[0.98]"
                        >
                            <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl shadow-slate-900/10 transition-all">

                                {/* Cabeçalho */}
                                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <span className={`rounded-lg p-2 ${meta.tone}`}>
                                            <meta.Icon className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0">
                                            <Dialog.Title as="h3" className="truncate text-[15px] font-semibold leading-tight text-slate-900">
                                                {transaction.subject || meta.label}
                                            </Dialog.Title>
                                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-400">
                                                <span>{meta.label}</span>
                                                {transaction.subject_detail && <><span>·</span><span>{transaction.subject_detail}</span></>}
                                                <span>·</span>
                                                <span className="font-mono">
                                                    {transaction.date_is_approximate && '≈ '}
                                                    {formatDate(transaction.created_at)}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="max-h-[70vh] overflow-y-auto">
                                    {/* Valor + estado */}
                                    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-5 py-4">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                                {chargedDiffers ? 'Valor base' : 'Total'}
                                            </p>
                                            <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                                                {formatCurrency(transaction.amount, transaction.currency)}
                                            </p>
                                            {chargedDiffers && (
                                                <p className="mt-1 font-mono text-xs text-amber-600 tabular-nums">
                                                    {formatCurrency(transaction.charged_amount!, transaction.currency)} debitados no gateway (c/ taxa)
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize ${statusTone}`}>
                                                {transaction.status}
                                            </span>
                                            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                                {transaction.provider || transaction.method || '—'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Identificadores */}
                                    <Section title="Identificadores no gateway">
                                        <Row label="Descrição Reduniq" value={transaction.gateway_description} copyKey="gw-desc" copied={copied} onCopy={handleCopy}
                                            empty="Pagamento fora do Reduniq (transferência, manual ou legacy)" />
                                        <Row label="Referência" value={transaction.external_reference || transaction.reference} copyKey="ref" copied={copied} onCopy={handleCopy} />
                                        <Row label="ID da transação" value={transaction.gateway_transaction_id} copyKey="tx" copied={copied} onCopy={handleCopy}
                                            empty="Só existe em pagamentos concluídos" />
                                        <Row label="Token" value={transaction.payment_token} copyKey="token" copied={copied} onCopy={handleCopy} />
                                    </Section>

                                    {/* Entidade */}
                                    <Section
                                        title="Entidade"
                                        action={
                                            <button
                                                onClick={copyBillingInfo}
                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                            >
                                                {copied === 'billing' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                                Copiar dados de faturação
                                            </button>
                                        }
                                    >
                                        <Row label="Nome" value={transaction.customer_name} copyKey="name" copied={copied} onCopy={handleCopy} mono={false} />
                                        <Row label="Email" value={transaction.customer_email} copyKey="email" copied={copied} onCopy={handleCopy} mono={false} />
                                        <Row label="NIF" value={transaction.customer_nif} copyKey="nif" copied={copied} onCopy={handleCopy} empty="Não fornecido" />
                                        {transaction.customer_address && (
                                            <Row
                                                label="Morada"
                                                value={[
                                                    transaction.customer_address,
                                                    [transaction.customer_zip, transaction.customer_city].filter(Boolean).join(' '),
                                                    transaction.customer_country,
                                                ].filter(Boolean).join(', ')}
                                                copyKey="addr" copied={copied} onCopy={handleCopy} mono={false}
                                            />
                                        )}
                                    </Section>

                                    {/* Itens */}
                                    {transaction.items && transaction.items.length > 0 && (
                                        <Section title="Itens">
                                            <div className="space-y-1.5">
                                                {transaction.items.map((item, i) => (
                                                    <div key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                                                        <span className="min-w-0 truncate text-slate-700">
                                                            <span className="font-mono text-slate-400">{item.qty}×</span> {item.name}
                                                        </span>
                                                        <span className="flex-shrink-0 font-mono text-slate-900 tabular-nums">
                                                            {formatCurrency(item.total, transaction.currency)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </Section>
                                    )}

                                    {/* Notas */}
                                    {transaction.notes && (
                                        <Section title="Notas">
                                            <p className="rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600">
                                                {transaction.notes}
                                            </p>
                                        </Section>
                                    )}

                                    {transaction.proof_url && (
                                        <div className="px-5 pb-5">
                                            <a
                                                href={transaction.proof_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                            >
                                                <FileText className="h-3.5 w-3.5" />
                                                Ver comprovativo
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="border-b border-slate-100 px-5 py-4 last:border-0">
            <div className="mb-2.5 flex items-center justify-between">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
                {action}
            </div>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

function Row({ label, value, copyKey, copied, onCopy, empty, mono = true }: {
    label: string;
    value?: string | null;
    copyKey: string;
    copied: string | null;
    onCopy: (text: string, id: string) => void;
    empty?: string;
    mono?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <span className="flex-shrink-0 text-[12px] text-slate-400">{label}</span>
            {value ? (
                <button
                    onClick={() => onCopy(value, copyKey)}
                    title="Clique para copiar"
                    className="group flex min-w-0 items-center gap-1.5 rounded px-1 text-right transition-colors hover:bg-slate-100"
                >
                    <span className={`truncate text-[12px] text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
                    {copied === copyKey
                        ? <Check className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                        : <Copy className="h-3 w-3 flex-shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />}
                </button>
            ) : (
                <span className="truncate text-right text-[12px] italic text-slate-300">{empty || '—'}</span>
            )}
        </div>
    );
}
