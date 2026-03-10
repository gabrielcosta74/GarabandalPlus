"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';

type PilgrimagePaymentWarningModalProps = {
    isOpen: boolean;
    onClose: () => void;
    continueLink: string;
};

export default function PilgrimagePaymentWarningModal({
    isOpen,
    onClose,
    continueLink
}: PilgrimagePaymentWarningModalProps) {
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[100000001]">
            <button
                type="button"
                aria-label="Fechar aviso de inscrição"
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-6">
                <div className="relative ml-auto w-full max-w-xl rounded-t-[28px] bg-white shadow-2xl md:rounded-[32px]">
                    <div className="border-b border-slate-100 px-5 py-4 md:px-8 md:py-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                                    <AlertTriangle className="h-6 w-6" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900">Antes de iniciar a inscrição</h2>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                    Leia este aviso antes de avançar para o formulário.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 px-5 py-5 md:px-8 md:py-8">
                        <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5">
                            <p className="text-base font-semibold leading-relaxed text-yellow-950">
                                Após realizar a sua inscrição terá que realizar num prazo máximo de 5 dias úteis, o pagamento/doação do valor da inscrição para confirmar e garantir a sua inscrição.
                            </p>
                        </div>

                        <p className="text-sm leading-relaxed text-slate-600">
                            Se não fizer esse pagamento dentro do prazo, a sua inscrição poderá não ficar confirmada.
                        </p>
                    </div>

                    <div className="border-t border-slate-100 px-5 py-4 md:px-8 md:py-5">
                        <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <Link
                                href={continueLink}
                                onClick={onClose}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-slate-950 transition-colors hover:bg-yellow-500"
                            >
                                Continuar para inscrição
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
