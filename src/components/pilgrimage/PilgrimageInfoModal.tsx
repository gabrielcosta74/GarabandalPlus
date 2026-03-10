"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, Plane, Users, X, MapPin, ShieldCheck, ArrowRight } from 'lucide-react';
import { useCurrency } from '../providers/CurrencyProvider';

type PilgrimageInfoModalProps = {
    mode: 'included' | 'flights';
    isOpen: boolean;
    onClose: () => void;
    registrationLink: string;
    includedItems: string[];
    notIncludedItems: string[];
    flightInfoText?: string;
    flightPriceFrom?: number;
    groupFlightDetails?: string;
    meetingPointText?: string;
    meetingEndText?: string;
};

export default function PilgrimageInfoModal({
    mode,
    isOpen,
    onClose,
    registrationLink,
    includedItems,
    notIncludedItems,
    flightInfoText,
    flightPriceFrom,
    groupFlightDetails,
    meetingPointText,
    meetingEndText
}: PilgrimageInfoModalProps) {
    const { formatPrice } = useCurrency();

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

    const isIncludedMode = mode === 'included';

    return (
        <div className="fixed inset-0 z-[100000000]">
            <button
                type="button"
                aria-label="Fechar"
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-6">
                <div className="relative ml-auto flex h-[94vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-[32px]">
                    <div className="border-b border-slate-100 px-5 py-3 md:px-8 md:py-6">
                        <div className="mb-3 flex items-start justify-between gap-4 md:mb-4">
                            <div>
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-yellow-700">
                                    Informação Importante
                                </p>
                                <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
                                    {isIncludedMode ? 'O que está incluído' : 'Opções de voo'}
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                    {isIncludedMode
                                        ? 'Veja exatamente o que está incluído no valor apresentado antes de avançar.'
                                        : 'Veja como funcionam os voos e o que é pago à parte.'}
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

                        <div className="grid gap-2 md:gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-yellow-800">
                                    Para evitar dúvidas
                                </p>
                                <p className="text-sm font-medium leading-relaxed text-yellow-900">
                                    O valor principal desta peregrinação é o valor do terrestre. O voo não está incluído nesse valor base.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                                    Antes de pagar
                                </p>
                                <p className="text-sm font-medium leading-relaxed text-slate-700">
                                    Confirme primeiro estes detalhes. Assim sabe exatamente o que está a contratar e o que é tratado à parte.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 md:space-y-6 md:px-8 md:py-8">
                        {isIncludedMode ? (
                            <>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
                                        <div className="mb-4 flex items-center gap-2 text-emerald-700">
                                            <CheckCircle2 className="h-5 w-5" />
                                            <h3 className="text-lg font-bold">Incluído no valor</h3>
                                        </div>
                                        <ul className="space-y-3">
                                            {includedItems.length > 0 ? includedItems.map((item, index) => (
                                                <li key={`${item}-${index}`} className="flex items-start gap-3 text-sm font-medium leading-relaxed text-slate-700">
                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                    <span>{item}</span>
                                                </li>
                                            )) : (
                                                <li className="text-sm italic text-slate-500">Sem detalhes adicionais.</li>
                                            )}
                                        </ul>
                                    </div>

                                    <div className="rounded-3xl border border-slate-200 bg-white p-6">
                                        <div className="mb-4 flex items-center gap-2 text-slate-700">
                                            <ShieldCheck className="h-5 w-5" />
                                            <h3 className="text-lg font-bold">Não incluído</h3>
                                        </div>
                                        <ul className="space-y-3">
                                            {notIncludedItems.length > 0 ? notIncludedItems.map((item, index) => (
                                                <li key={`${item}-${index}`} className="flex items-start gap-3 text-sm leading-relaxed text-slate-600">
                                                    <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                                    <span>{item}</span>
                                                </li>
                                            )) : (
                                                <li className="text-sm italic text-slate-500">Nada de relevante a assinalar fora do pacote base.</li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                                        <div className="mb-4 flex items-center gap-2 text-slate-800">
                                            <Plane className="h-5 w-5" />
                                            <h3 className="text-lg font-bold">Voo próprio</h3>
                                        </div>
                                        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Flexibilidade
                                        </p>
                                        <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                                            {flightInfoText || 'Pode tratar do seu voo diretamente e encontrar-se com o grupo no ponto indicado pela organização.'}
                                        </p>
                                    </div>

                                    <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-6">
                                        <div className="mb-4 flex items-center gap-2 text-indigo-800">
                                            <Users className="h-5 w-5" />
                                            <h3 className="text-lg font-bold">Voo de grupo</h3>
                                        </div>
                                        {flightPriceFrom ? (
                                            <>
                                                <p className="mb-4 text-sm leading-relaxed text-indigo-900">
                                                    Se preferir, pode seguir no voo organizado pela agência. Este valor é separado do terrestre.
                                                </p>
                                                {groupFlightDetails && (
                                                    <div className="mb-4 rounded-2xl border border-indigo-100 bg-white/80 p-4 text-sm leading-relaxed text-indigo-900 whitespace-pre-line">
                                                        {groupFlightDetails}
                                                    </div>
                                                )}
                                                <div className="rounded-2xl bg-white p-4 shadow-sm">
                                                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-500">
                                                        Valor de referência
                                                    </p>
                                                    <p className="text-3xl font-black text-indigo-700">
                                                        {formatPrice(flightPriceFrom)}
                                                    </p>
                                                    <p className="mt-2 text-xs leading-relaxed text-indigo-500">
                                                        Este pagamento é tratado diretamente com a agência parceira.
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm leading-relaxed text-slate-600">
                                                Nesta peregrinação não há neste momento uma opção de voo de grupo publicada.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {(meetingPointText || meetingEndText) && (
                                    <div className="rounded-3xl border border-slate-200 bg-white p-6">
                                        <div className="mb-4 flex items-center gap-2 text-slate-800">
                                            <MapPin className="h-5 w-5" />
                                            <h3 className="text-lg font-bold">Encontro e regresso</h3>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {meetingPointText && (
                                                <div className="rounded-2xl bg-slate-50 p-4">
                                                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-600">Ponto de encontro</p>
                                                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{meetingPointText}</p>
                                                </div>
                                            )}
                                            {meetingEndText && (
                                                <div className="rounded-2xl bg-slate-50 p-4">
                                                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-500">Fim da viagem</p>
                                                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{meetingEndText}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="border-t border-slate-100 bg-white px-5 py-3 md:px-8 md:py-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <p className="text-sm leading-relaxed text-slate-500">
                                {isIncludedMode
                                    ? 'Se ficou claro, volte ao formulário e avance com a inscrição.'
                                    : 'Primeiro confirme a opção de voo. Depois avance com a inscrição.'}
                            </p>
                            <div className="flex flex-col gap-2 md:flex-row">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    Fechar
                                </button>
                                <Link
                                    href={registrationLink}
                                    onClick={onClose}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-slate-950 transition-colors hover:bg-yellow-500"
                                >
                                    Quero inscrever-me
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
