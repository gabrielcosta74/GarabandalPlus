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
    paymentPlanText?: string;
    cancellationPolicyText?: string;
    basePrice?: number;
    depositValue?: number;
    accommodationRating?: string;
    accommodationDescription?: string;
    accommodationImage?: string;
    transportType?: string;
    transportDescription?: string;
    transportImage?: string;
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
    meetingEndText,
    paymentPlanText,
    cancellationPolicyText,
    basePrice,
    depositValue,
    accommodationRating,
    accommodationDescription,
    accommodationImage,
    transportType,
    transportDescription,
    transportImage
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

            <div className="absolute inset-0 overflow-y-auto z-10">
                <div className="flex min-h-full items-end justify-center md:items-center p-0 md:p-6 pt-16">
                    <div className="relative flex w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:max-w-2xl md:rounded-[32px]">
                        <div className="border-b border-slate-100 px-5 py-6 md:px-8 md:py-8">
                        <div className="mb-3 flex items-start justify-between gap-4 md:mb-4">
                            <div>
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-yellow-700">
                                    Informação Importante
                                </p>
                                <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
                                    {isIncludedMode ? 'Incluído no valor de terrestre' : 'Opções de voo'}
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

                    <div className="space-y-5 px-5 py-5 md:space-y-6 md:px-8 md:py-8">
                        {isIncludedMode ? (
                            <>
                                {typeof basePrice === 'number' && typeof depositValue === 'number' && (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 mb-6">
                                        <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                            Cálculo do Valor Terrestre
                                        </h4>
                                        <div className="flex flex-col gap-3 text-sm text-slate-600">
                                            <div className="flex justify-between items-center">
                                                <span>Valor base:</span>
                                                <span className="font-semibold text-slate-800">{formatPrice(basePrice)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>Taxa de inscrição:</span>
                                                <span className="font-semibold text-slate-800">{formatPrice(depositValue)}</span>
                                            </div>
                                            <div className="pt-3 mt-1 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900 text-lg">
                                                <span>Valor Total do Terrestre:</span>
                                                <span>{formatPrice(basePrice + depositValue)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {((accommodationRating || accommodationDescription) || (transportType || transportDescription)) && (
                                    <div className="grid gap-6 md:grid-cols-2 mb-6">
                                        {(accommodationRating || accommodationDescription) && (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden flex flex-col">
                                                {accommodationImage && (
                                                    <div className="w-full h-32 -mt-5 -mx-5 border-b border-slate-200 bg-slate-100 relative mb-4">
                                                        <img src={accommodationImage} alt="Alojamento" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mb-3 text-slate-800">
                                                    <h4 className="font-bold text-base flex items-center gap-2">
                                                        Alojamento
                                                        {accommodationRating && (
                                                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                                                                {accommodationRating}
                                                            </span>
                                                        )}
                                                    </h4>
                                                </div>
                                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line flex-1">
                                                    {accommodationDescription || 'Detalhes de alojamento não especificados.'}
                                                </p>
                                            </div>
                                        )}
                                        {(transportType || transportDescription) && (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden flex flex-col">
                                                {transportImage && (
                                                    <div className="w-full h-32 -mt-5 -mx-5 border-b border-slate-200 bg-slate-100 relative mb-4">
                                                        <img src={transportImage} alt="Transporte" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mb-3 text-slate-800">
                                                    <h4 className="font-bold text-base flex items-center gap-2">
                                                        Transporte
                                                        {transportType && (
                                                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                                                                {transportType}
                                                            </span>
                                                        )}
                                                    </h4>
                                                </div>
                                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line flex-1">
                                                    {transportDescription || 'Detalhes de transporte não especificados.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

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

                                {/* Financials & Policy */}
                                {(paymentPlanText || cancellationPolicyText) && (
                                    <div className="space-y-6 mt-8 border-t border-slate-100 pt-8">
                                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5 text-yellow-600" /> Condições e formas de pagamento / doação
                                        </h3>
                                        
                                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col items-center gap-4 w-full">
                                            <p className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                                                Pagamentos 100% Seguros
                                            </p>
                                            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
                                                {/* MULTIBANCO */}
                                                <div className="bg-white border border-slate-200 h-10 w-16 md:h-12 md:w-20 rounded-lg flex items-center justify-center shadow-sm" title="Multibanco">
                                                    <img src="/payment-icons/multibanco.svg" alt="Multibanco" className="h-5 md:h-6 w-auto" />
                                                </div>
                                                {/* MB WAY */}
                                                <div className="bg-white border border-slate-200 h-10 w-16 md:h-12 md:w-20 rounded-lg flex items-center justify-center shadow-sm" title="MB WAY">
                                                    <img src="/payment-icons/mbway.svg" alt="MB Way" className="h-5 md:h-6 w-auto" />
                                                </div>
                                                {/* VISA */}
                                                <div className="bg-white border border-slate-200 h-10 w-16 md:h-12 md:w-20 rounded-lg flex items-center justify-center shadow-sm" title="Visa">
                                                    <img src="/payment-icons/visa.svg" alt="Visa" className="h-3 md:h-4 w-auto" />
                                                </div>
                                                {/* MASTERCARD */}
                                                <div className="bg-white border border-slate-200 h-10 w-16 md:h-12 md:w-20 rounded-lg flex items-center justify-center shadow-sm" title="Mastercard">
                                                    <img src="/payment-icons/mastercard.svg" alt="Mastercard" className="h-6 md:h-8 w-auto" />
                                                </div>
                                                {/* PIX - HIGHLIGHT */}
                                                <div className="relative group">
                                                    <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
                                                    <div className="relative bg-slate-900 border border-white/10 h-10 md:h-12 px-4 md:px-6 rounded-lg flex items-center gap-3">
                                                        <img src="/payment-icons/pix-original.png" alt="PIX" className="h-5 md:h-6 w-auto" />
                                                        <span className="text-xs md:text-sm font-bold text-white whitespace-nowrap">Brasil 🇧🇷</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-6">
                                            {paymentPlanText && (
                                                <div className="bg-gradient-to-br from-indigo-50 to-indigo-50/30 p-6 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
                                                    <div className="flex items-start gap-4 relative z-10">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-indigo-900 mb-2">Facilidades de Doação</h4>
                                                            <p className="text-indigo-800/80 leading-relaxed whitespace-pre-line text-sm">{paymentPlanText}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {cancellationPolicyText && (
                                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                                    <details className="group">
                                                        <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50 transition-colors">
                                                            <div className="flex items-center gap-3 font-bold text-slate-700">
                                                                <ShieldCheck className="w-5 h-5 text-slate-400" />
                                                                Política de Cancelamento
                                                            </div>
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-open:rotate-180 transition-transform">
                                                                <ArrowRight className="w-4 h-4 rotate-90" />
                                                            </div>
                                                        </summary>
                                                        <div className="px-6 pb-8 text-sm text-slate-600 leading-relaxed whitespace-pre-line border-t border-slate-100 pt-4 bg-slate-50/30">
                                                            {cancellationPolicyText}
                                                        </div>
                                                    </details>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
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
        </div>
    );
}
