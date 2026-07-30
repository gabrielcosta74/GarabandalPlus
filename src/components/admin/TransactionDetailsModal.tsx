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
    CreditCard,
    Download,
    ExternalLink,
    LoaderCircle,
    Mail,
    ReceiptText,
    RotateCcw,
} from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

export type FactptDocumentSummary = {
    id: string;
    environment: 'sandbox' | 'production';
    status: 'awaiting_approval' | 'pending' | 'needs_data' | 'processing' | 'issued' | 'failed' | 'email_failed';
    series_code: string;
    document_type: 'invoice_receipt' | 'simplified_invoice' | null;
    client_action: 'reused' | 'created' | 'updated' | 'final_consumer' | null;
    factpt_number: string | null;
    permanent_url: string | null;
    last_error: string | null;
    issued_at: string | null;
    email_sent_at: string | null;
    review_prepared_at: string | null;
    approved_at: string | null;
    amount: number | null;
    payment_method: string | null;
    comments: string | null;
    fiscal_snapshot: {
        total?: number;
        currency?: string;
        paymentMethod?: string;
        reference?: string;
        customer?: {
            name?: string;
            email?: string;
            nif?: string | null;
            address?: string | null;
            postalCode?: string | null;
            city?: string | null;
            country?: string | null;
        };
        lines?: Array<{
            reference?: string;
            description?: string;
            quantity?: number;
            unitPriceNet?: number;
            taxRate?: number;
        }>;
    } | null;
};

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
    processing_fee_amount?: number | null;
    charged_amount?: number | null;
    gateway_description?: string | null;
    date_is_approximate?: boolean;
    details_link?: string;
    factpt_document?: FactptDocumentSummary | null;
    legacy_invoice_sent_at?: string | null;
    manual_fiscal_record?: boolean;
};

type TransactionDetailsModalProps = {
    transaction: TransactionDetail;
    onClose: () => void;
    onFactptChanged?: () => void | Promise<void>;
};

const CATEGORY_META = {
    shop: { label: 'Loja Online', Icon: Package, tone: 'bg-violet-50 text-violet-600' },
    donation: { label: 'Doação', Icon: Heart, tone: 'bg-rose-50 text-rose-600' },
    pilgrimage: { label: 'Peregrinação', Icon: Plane, tone: 'bg-amber-50 text-amber-600' },
    quota: { label: 'Quota de Membro', Icon: Users, tone: 'bg-teal-50 text-teal-600' },
} as const;

const PAID = ['paid', 'pago', 'succeeded', 'verified'];
const PENDING = ['pending', 'pendente', 'verifying', 'pending_verification'];

export default function TransactionDetailsModal({ transaction, onClose, onFactptChanged }: TransactionDetailsModalProps) {
    const [copied, setCopied] = useState<string | null>(null);
    const [factptAction, setFactptAction] = useState<'enqueue' | 'prepare' | 'approve' | 'retry' | 'resend' | 'download' | null>(null);
    const [factptFeedback, setFactptFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

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

    const factptRequest = async (action: 'prepare' | 'approve' | 'retry' | 'resend') => {
        const document = transaction.factpt_document;
        if (!document || !supabaseBrowser) return;

        setFactptAction(action);
        setFactptFeedback(null);
        try {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) throw new Error('A sessão de administrador expirou.');

            const response = await fetch(`/api/admin/factpt/documents/${document.id}/${action}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    confirmProduction:
                        action === 'approve' && document.environment === 'production',
                }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(body?.error || body?.message || 'Não foi possível concluir a ação.');
            }

            setFactptFeedback({
                tone: 'success',
                message: {
                    prepare: 'Dados fiscais preparados. Confirma todos os campos antes de aprovar.',
                    approve: 'Fatura aprovada e colocada na fila de emissão.',
                    retry: 'Emissão novamente colocada na fila.',
                    resend: 'Email reenviado.',
                }[action],
            });
            await onFactptChanged?.();
        } catch (error) {
            setFactptFeedback({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Não foi possível concluir a ação.',
            });
        } finally {
            setFactptAction(null);
        }
    };

    const approveFactpt = () => {
        const document = transaction.factpt_document;
        if (!document) return;
        if (
            document.environment === 'production'
            && !window.confirm(
                'Isto vai libertar uma Fatura-Recibo real na FACT.pt e enviar o PDF ao titular. Confirmas que todos os dados apresentados estão corretos?',
            )
        ) {
            return;
        }
        void factptRequest('approve');
    };

    const enqueueFactptSandbox = async () => {
        if (!supabaseBrowser) return;
        const mapping = {
            shop: { sourceType: 'store', sourceTable: 'store_orders' },
            donation: { sourceType: 'donation', sourceTable: 'donations' },
            quota: { sourceType: 'quota', sourceTable: 'pagamentos_quotas' },
            pilgrimage: { sourceType: 'pilgrimage', sourceTable: 'pilgrimage_payments' },
        } as const;

        setFactptAction('enqueue');
        setFactptFeedback(null);
        try {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) throw new Error('A sessão de administrador expirou.');
            const response = await fetch('/api/admin/factpt/enqueue', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...mapping[transaction.category],
                    sourceId: transaction.id,
                    confirmFictitious: true,
                }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(body?.error || 'Não foi possível criar o teste sandbox.');
            }
            setFactptFeedback({
                tone: 'success',
                message: 'Pagamento guardado para validação. Nenhuma fatura foi emitida.',
            });
            await onFactptChanged?.();
        } catch (error) {
            setFactptFeedback({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Não foi possível criar o teste sandbox.',
            });
        } finally {
            setFactptAction(null);
        }
    };

    const downloadFactptPdf = async () => {
        const document = transaction.factpt_document;
        if (!document || !supabaseBrowser) return;

        setFactptAction('download');
        setFactptFeedback(null);
        try {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) throw new Error('A sessão de administrador expirou.');

            const response = await fetch(`/api/admin/factpt/documents/${document.id}/download`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || body?.message || 'Não foi possível descarregar o PDF.');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = window.document.createElement('a');
            link.href = url;
            link.download = `${document.factpt_number || transaction.reference}.pdf`.replace(/[^\w.-]+/g, '_');
            window.document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            setFactptFeedback({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Não foi possível descarregar o PDF.',
            });
        } finally {
            setFactptAction(null);
        }
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
                                                <div className="mt-1 space-y-0.5 font-mono text-xs text-amber-600 tabular-nums">
                                                    <p>
                                                        Taxa Reduniq: {formatCurrency(
                                                            transaction.processing_fee_amount
                                                                ?? transaction.charged_amount! - transaction.amount,
                                                            transaction.currency,
                                                        )}
                                                    </p>
                                                    <p>
                                                        Total debitado: {formatCurrency(transaction.charged_amount!, transaction.currency)}
                                                    </p>
                                                </div>
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

                                    <FactptSection
                                        transaction={transaction}
                                        activeAction={factptAction}
                                        feedback={factptFeedback}
                                        onPrepare={() => factptRequest('prepare')}
                                        onApprove={approveFactpt}
                                        onRetry={() => factptRequest('retry')}
                                        onResend={() => factptRequest('resend')}
                                        onDownload={downloadFactptPdf}
                                        onEnqueue={enqueueFactptSandbox}
                                    />

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

function FactptSection({
    transaction,
    activeAction,
    feedback,
    onEnqueue,
    onPrepare,
    onApprove,
    onRetry,
    onResend,
    onDownload,
}: {
    transaction: TransactionDetail;
    activeAction: 'enqueue' | 'prepare' | 'approve' | 'retry' | 'resend' | 'download' | null;
    feedback: { tone: 'success' | 'error'; message: string } | null;
    onEnqueue: () => void;
    onPrepare: () => void;
    onApprove: () => void;
    onRetry: () => void;
    onResend: () => void;
    onDownload: () => void;
}) {
    const document = transaction.factpt_document;

    if (!document) {
        const manuallyIssued = Boolean(
            transaction.manual_fiscal_record || transaction.legacy_invoice_sent_at,
        );
        const canEnqueueSandbox =
            PAID.includes(transaction.status?.toLowerCase() || '')
            && (
                transaction.customer_email?.toLowerCase().endsWith('.test')
                || transaction.category === 'pilgrimage'
            );
        return (
            <Section title="Faturação FACT.pt">
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[12px] font-medium text-slate-600">
                        {manuallyIssued ? 'Emitida manualmente' : 'Sem documento FACT.pt associado'}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                        {manuallyIssued
                            ? 'Documento emitido na FACT.pt antes da integração automática. O número não está sincronizado localmente.'
                            : 'Este pagamento ainda não tem documento fiscal associado.'}
                    </p>
                    {transaction.legacy_invoice_sent_at && (
                        <p className="mt-2 text-[11px] text-slate-500">
                            Registado em {formatFactptDate(transaction.legacy_invoice_sent_at)}.
                        </p>
                    )}
                    {canEnqueueSandbox && (
                        <div className="mt-3">
                            <FactptActionButton
                                label="Adicionar à sandbox"
                                loading={activeAction === 'enqueue'}
                                disabled={activeAction !== null}
                                Icon={ReceiptText}
                                onClick={onEnqueue}
                            />
                        </div>
                    )}
                    {feedback && (
                        <p className={`mt-2 text-[11px] ${feedback.tone === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {feedback.message}
                        </p>
                    )}
                </div>
            </Section>
        );
    }

    const canRetry = document.status === 'failed' || document.status === 'needs_data';
    const canUseIssuedDocument = document.status === 'issued' || document.status === 'email_failed';
    const canPrepareReview =
        document.status === 'awaiting_approval' && !document.review_prepared_at;
    const canApprove =
        document.status === 'awaiting_approval' && Boolean(document.review_prepared_at);
    const statusMeta = FACTPT_STATUS_META[document.status] || FACTPT_STATUS_META.pending;
    const permanentUrl = isSafeHttpUrl(document.permanent_url) ? document.permanent_url : null;
    const fiscal = document.fiscal_snapshot;
    const fiscalCustomer = fiscal?.customer;
    const fiscalLines = Array.isArray(fiscal?.lines) ? fiscal.lines : [];
    const fiscalAddress = [
        fiscalCustomer?.address,
        [fiscalCustomer?.postalCode, fiscalCustomer?.city].filter(Boolean).join(' '),
        fiscalCustomer?.country?.toUpperCase(),
    ].filter(Boolean).join(' · ');
    const fiscalTotal = typeof fiscal?.total === 'number'
        ? fiscal.total
        : document.amount;

    return (
        <Section title="Faturação FACT.pt">
            <div className="rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-3 py-3">
                    <div className="flex items-start gap-2.5">
                        <span className="rounded-md bg-slate-100 p-1.5 text-slate-600">
                            <ReceiptText className="h-3.5 w-3.5" />
                        </span>
                        <div>
                            <p className="font-mono text-[12px] font-semibold text-slate-900">
                                {document.factpt_number || `${document.series_code} · por numerar`}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                                {document.document_type === 'invoice_receipt'
                                    ? 'Fatura-Recibo'
                                    : document.document_type === 'simplified_invoice'
                                        ? 'Fatura Simplificada'
                                        : 'Tipo por determinar'}
                            </p>
                        </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ${statusMeta.tone}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                    </span>
                </div>

                <div className="space-y-1.5 px-3 py-3">
                    <FactptRow
                        label="Ambiente"
                        value={document.environment === 'production' ? 'Produção' : 'Sandbox'}
                    />
                    <FactptRow label="Série" value={document.series_code} />
                    <FactptRow
                        label="Cliente FACT.pt"
                        value={
                            document.client_action === 'created'
                                ? 'Criado'
                                : document.client_action === 'updated'
                                    ? 'Reutilizado e atualizado'
                                    : document.client_action === 'reused'
                                        ? 'Reutilizado'
                                        : document.client_action === 'final_consumer'
                                            ? 'Consumidor Final'
                                            : null
                        }
                    />
                    <FactptRow label="Aprovado" value={document.approved_at ? formatFactptDate(document.approved_at) : null} />
                    <FactptRow label="Emitido" value={document.issued_at ? formatFactptDate(document.issued_at) : null} />
                    <FactptRow label="Email enviado" value={document.email_sent_at ? formatFactptDate(document.email_sent_at) : null} />
                </div>

                {document.status === 'awaiting_approval' && (
                    <div className="border-t border-amber-100 bg-amber-50/70 px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Validação antes da emissão
                        </p>
                        {!document.review_prepared_at ? (
                            <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                                A FACT.pt ainda não foi chamada para emitir. Prepara os dados para confirmar impostos e artigos.
                            </p>
                        ) : (
                            <div className="mt-2 space-y-1.5">
                                <FactptRow label="Titular" value={fiscalCustomer?.name || null} />
                                <FactptRow label="Email" value={fiscalCustomer?.email || null} />
                                <FactptRow
                                    label="Contribuinte"
                                    value={fiscalCustomer?.nif || 'Consumidor final'}
                                />
                                <FactptRow label="Morada" value={fiscalAddress || null} />
                                <FactptRow label="Referência" value={fiscal?.reference || null} />
                                <FactptRow
                                    label="Meio de pagamento"
                                    value={fiscal?.paymentMethod || document.payment_method}
                                />
                                <FactptRow
                                    label="Total a faturar"
                                    value={
                                        typeof fiscalTotal === 'number'
                                            ? formatFactptCurrency(fiscalTotal, fiscal?.currency || 'EUR')
                                            : null
                                    }
                                />
                                <FactptRow label="Observações" value={document.comments} />
                                {fiscalLines.map((line, index) => (
                                    <div
                                        key={`${line.reference || 'linha'}-${index}`}
                                        className="mt-2 rounded-md border border-amber-200 bg-white/80 px-2.5 py-2"
                                    >
                                        <p className="text-[11px] font-semibold text-slate-800">
                                            {line.description || `Linha ${index + 1}`}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-slate-500">
                                            {line.reference || '—'} · Qtd. {line.quantity || 0} · IVA {line.taxRate ?? 0}%
                                        </p>
                                    </div>
                                ))}
                                <p className="pt-1 text-[10px] leading-relaxed text-amber-700">
                                    Aprovar liberta exatamente este snapshot para emissão
                                    {document.environment === 'production'
                                        ? ' real e envio ao titular.'
                                        : ' na sandbox e envio ao email de teste.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {document.last_error && (
                    <div className="border-t border-rose-100 bg-rose-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">Último erro</p>
                        <p className="mt-1 break-words text-[11px] leading-relaxed text-rose-700">{document.last_error}</p>
                    </div>
                )}

                {document.status === 'needs_data' && transaction.details_link && (
                    <div className="border-t border-amber-100 bg-amber-50 px-3 py-2.5">
                        <p className="text-[11px] leading-relaxed text-amber-700">
                            Faltam dados fiscais. Corrige-os na área de origem antes de tentar novamente.
                        </p>
                        <a
                            href={transaction.details_link}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:underline"
                        >
                            Abrir registo de origem
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                )}

                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2.5">
                    {canPrepareReview && (
                        <FactptActionButton
                            label="Preparar validação"
                            loading={activeAction === 'prepare'}
                            disabled={activeAction !== null}
                            Icon={FileText}
                            onClick={onPrepare}
                        />
                    )}
                    {canApprove && (
                        <FactptActionButton
                            label="Aprovar e emitir"
                            loading={activeAction === 'approve'}
                            disabled={activeAction !== null}
                            Icon={Check}
                            onClick={onApprove}
                        />
                    )}
                    {canRetry && (
                        <FactptActionButton
                            label={document.status === 'needs_data' ? 'Validar novamente' : 'Repetir emissão'}
                            loading={activeAction === 'retry'}
                            disabled={activeAction !== null}
                            Icon={RotateCcw}
                            onClick={onRetry}
                        />
                    )}
                    {canUseIssuedDocument && (
                        <>
                            <FactptActionButton
                                label="Descarregar PDF"
                                loading={activeAction === 'download'}
                                disabled={activeAction !== null}
                                Icon={Download}
                                onClick={onDownload}
                            />
                            <FactptActionButton
                                label="Reenviar email"
                                loading={activeAction === 'resend'}
                                disabled={activeAction !== null}
                                Icon={Mail}
                                onClick={onResend}
                            />
                        </>
                    )}
                    {permanentUrl && (
                        <a
                            href={permanentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Abrir na FACT.pt
                        </a>
                    )}
                </div>
            </div>

            {feedback && (
                <p className={`mt-2 rounded-md px-2.5 py-2 text-[11px] ${
                    feedback.tone === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                }`}>
                    {feedback.message}
                </p>
            )}
        </Section>
    );
}

const FACTPT_STATUS_META: Record<string, { label: string; tone: string; dot: string }> = {
    awaiting_approval: { label: 'Aguarda aprovação', tone: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
    pending: { label: 'Por emitir', tone: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    needs_data: { label: 'Requer dados', tone: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
    processing: { label: 'A processar', tone: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
    issued: { label: 'Emitido', tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    failed: { label: 'Erro de emissão', tone: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
    email_failed: { label: 'Erro de email', tone: 'bg-fuchsia-50 text-fuchsia-700', dot: 'bg-fuchsia-500' },
};

function formatFactptCurrency(value: number, currency: string) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency,
    }).format(value);
}

function FactptRow({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <span className="text-[11px] text-slate-400">{label}</span>
            <span className="font-mono text-[11px] text-slate-700">{value || '—'}</span>
        </div>
    );
}

function FactptActionButton({
    label,
    loading,
    disabled,
    Icon,
    onClick,
}: {
    label: string;
    loading: boolean;
    disabled: boolean;
    Icon: typeof Download;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-wait disabled:opacity-50"
        >
            {loading ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
            {label}
        </button>
    );
}

function formatFactptDate(value: string): string {
    return new Date(value).toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function isSafeHttpUrl(value: string | null): value is string {
    return typeof value === 'string' && /^https?:\/\//i.test(value);
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
