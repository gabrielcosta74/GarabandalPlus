"use client";

import { Dialog, Transition } from '@headlessui/react';
import { Check, FileText, Loader2, Mail, X } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

export type PaymentConfirmationFiscalDocument = {
    status?: string | null;
    factpt_number?: string | null;
    issued_at?: string | null;
    email_sent_at?: string | null;
} | null;

export const resolvePaymentConfirmationInvoiceState = (
    document: PaymentConfirmationFiscalDocument,
): 'preparing' | 'issued' | 'sent' => {
    if (document?.email_sent_at) return 'sent';
    if (
        document?.issued_at
        || document?.status === 'issued'
        || document?.status === 'email_failed'
    ) {
        return 'issued';
    }
    return 'preparing';
};

type PaymentConfirmationModalProps = {
    open: boolean;
    onClose: () => void;
    isEn: boolean;
    amountLabel?: string | null;
    fiscalDocument: PaymentConfirmationFiscalDocument;
};

export default function PaymentConfirmationModal({
    open,
    onClose,
    isEn,
    amountLabel,
    fiscalDocument,
}: PaymentConfirmationModalProps) {
    const invoiceState = resolvePaymentConfirmationInvoiceState(fiscalDocument);
    const invoiceCopy = invoiceState === 'sent'
        ? {
            title: isEn ? 'Invoice sent by email' : 'Fatura enviada por email',
            description: isEn
                ? 'The official PDF has been sent to the email address on your account.'
                : 'O PDF oficial foi enviado para o email associado à tua conta.',
        }
        : invoiceState === 'issued'
            ? {
                title: isEn ? 'Invoice issued' : 'Fatura emitida',
                description: isEn
                    ? 'We are completing the email delivery. You do not need to do anything.'
                    : 'Estamos a concluir o envio por email. Não precisas de fazer nada.',
            }
            : {
                title: isEn ? 'Preparing your invoice' : 'A preparar a tua fatura',
                description: isEn
                    ? 'It will be sent automatically by email as soon as it is ready.'
                    : 'Será enviada automaticamente por email assim que estiver pronta.',
            };

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="relative z-[70]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="translate-y-full opacity-0 sm:translate-y-4 sm:scale-[0.98]"
                            enterTo="translate-y-0 opacity-100 sm:scale-100"
                            leave="ease-in duration-150"
                            leaveFrom="translate-y-0 opacity-100 sm:scale-100"
                            leaveTo="translate-y-full opacity-0 sm:translate-y-4 sm:scale-[0.98]"
                        >
                            <Dialog.Panel
                                className="max-h-[calc(100dvh-0.5rem)] w-full overflow-y-auto rounded-t-[28px] bg-[#0d1117] text-white shadow-2xl ring-1 ring-white/10 sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-3xl"
                                style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
                            >
                                <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-white/15 sm:hidden" />

                                <div className="relative px-5 pb-2 pt-6 text-center sm:px-7 sm:pt-7">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white"
                                        aria-label={isEn ? 'Close confirmation' : 'Fechar confirmação'}
                                    >
                                        <X className="h-5 w-5" />
                                    </button>

                                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400 ring-1 ring-emerald-400/20">
                                        <Check className="h-8 w-8" strokeWidth={2.5} />
                                    </div>
                                    <Dialog.Title className="mt-5 text-2xl font-bold tracking-tight">
                                        {isEn ? 'Payment confirmed' : 'Pagamento confirmado'}
                                    </Dialog.Title>
                                    <p className="mt-2 text-sm leading-relaxed text-white/50">
                                        {isEn
                                            ? 'Everything is recorded correctly in your booking.'
                                            : 'Ficou tudo registado corretamente na tua reserva.'}
                                    </p>
                                    {amountLabel ? (
                                        <p className="mt-3 font-mono text-xl font-bold text-amber-300">
                                            {amountLabel}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="mx-5 mt-5 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.07] sm:mx-7">
                                    <ConfirmationStep
                                        icon={<Check className="h-4 w-4" />}
                                        title={isEn ? 'Payment received' : 'Pagamento recebido'}
                                        description={isEn ? 'Confirmed by Reduniq' : 'Confirmado pela Reduniq'}
                                        complete
                                    />
                                    <ConfirmationStep
                                        icon={<Check className="h-4 w-4" />}
                                        title={isEn ? 'Booking updated' : 'Reserva atualizada'}
                                        description={isEn ? 'Your payment progress is up to date' : 'O progresso do pagamento está atualizado'}
                                        complete
                                    />
                                    <ConfirmationStep
                                        icon={
                                            invoiceState === 'sent'
                                                ? <Mail className="h-4 w-4" />
                                                : invoiceState === 'issued'
                                                    ? <FileText className="h-4 w-4" />
                                                    : <Loader2 className="h-4 w-4 animate-spin" />
                                        }
                                        title={invoiceCopy.title}
                                        description={invoiceCopy.description}
                                        complete={invoiceState === 'sent'}
                                        pending={invoiceState !== 'sent'}
                                        announce
                                        isLast
                                    />
                                </div>

                                <div className="px-5 pt-6 sm:px-7">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-amber-400 px-5 text-base font-bold text-slate-950 transition-colors hover:bg-amber-300 active:bg-amber-500"
                                    >
                                        {isEn ? 'Continue to booking' : 'Continuar na reserva'}
                                    </button>
                                    <p className="mt-3 text-center text-xs leading-relaxed text-white/30">
                                        {isEn
                                            ? 'You can close this window safely. The invoice process continues automatically.'
                                            : 'Podes fechar esta janela. O processo da fatura continua automaticamente.'}
                                    </p>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

function ConfirmationStep({
    icon,
    title,
    description,
    complete = false,
    pending = false,
    announce = false,
    isLast = false,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    complete?: boolean;
    pending?: boolean;
    announce?: boolean;
    isLast?: boolean;
}) {
    const tone = complete
        ? 'bg-emerald-400/15 text-emerald-300'
        : pending
            ? 'bg-amber-400/15 text-amber-300'
            : 'bg-white/10 text-white/50';

    return (
        <div
            className={`flex gap-3.5 px-4 py-4 ${isLast ? '' : 'border-b border-white/[0.07]'}`}
            role={announce ? 'status' : undefined}
            aria-live={announce ? 'polite' : undefined}
        >
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/40">{description}</p>
            </div>
        </div>
    );
}
