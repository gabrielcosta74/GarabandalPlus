"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, Plane, Users, X, MapPin, ShieldCheck, ArrowRight } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { PilgrimagePrice } from './PilgrimagePrice';
import {
    CountryBasedFlightPolicy,
    formatFlightEstimate,
    parseCountryBasedFlightPolicy,
} from '../../lib/pilgrimage-flight-policy';

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
    flightRegistrationPolicy?: CountryBasedFlightPolicy | null;
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

function normalizeListItems(items: string[]) {
    const normalizedItems = items
        .flatMap((item) => String(item || '').split(/[\n,;•]+/u))
        .map((item) => item.trim())
        .filter(Boolean);

    return Array.from(new Set(normalizedItems));
}

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
    flightRegistrationPolicy,
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
    const { locale } = useLocale();
    const isEn = locale === 'en';

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
    const countryBasedFlightPolicy = parseCountryBasedFlightPolicy(flightRegistrationPolicy);
    const normalizedIncludedItems = normalizeListItems(includedItems);
    const normalizedNotIncludedItems = normalizeListItems(notIncludedItems);

    return (
        <div className="fixed inset-0 z-[100000000]">
            <button
                type="button"
                aria-label={isEn ? 'Close' : 'Fechar'}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            <div className="absolute inset-0 overflow-y-auto z-10">
                <div className="flex min-h-full items-end justify-center md:items-center p-0 md:p-6 pt-16">
                    <div className="relative flex w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:max-w-4xl md:rounded-[32px]">
                        <div className="border-b border-slate-100 px-5 py-6 md:px-8 md:py-8">
                        <div className="mb-3 flex items-start justify-between gap-4 md:mb-4">
                            <div>
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-yellow-700">
                                    {isEn ? 'Important Information' : 'Informação Importante'}
                                </p>
                                <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
                                    {isIncludedMode
                                        ? (isEn ? 'Included in the land package' : 'Incluído no valor terrestre')
                                        : countryBasedFlightPolicy
                                            ? (isEn ? 'Mandatory flight rules' : 'Regras obrigatórias dos voos')
                                            : (isEn ? 'Flight options' : 'Opções de voo')}
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                    {isIncludedMode
                                        ? (isEn ? 'See exactly what is included in the advertised price before you continue.' : 'Veja exatamente o que está incluído no valor apresentado antes de avançar.')
                                        : (isEn ? 'See how the flights work and what is paid separately.' : 'Veja como funcionam os voos e o que é pago à parte.')}
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
                                    {isEn ? 'To avoid doubts' : 'Para evitar dúvidas'}
                                </p>
                                <p className="text-sm font-medium leading-relaxed text-yellow-900">
                                    {isEn ? 'The main price of this pilgrimage is the land package. Flights are not included in this base price.' : 'O valor principal desta peregrinação é o valor do terrestre. O voo não está incluído nesse valor base.'}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                                    {isEn ? 'Before paying' : 'Antes de pagar'}
                                </p>
                                <p className="text-sm font-medium leading-relaxed text-slate-700">
                                    {isEn ? 'Please confirm these details first. That way you know exactly what you are booking and what is handled separately.' : 'Confirme primeiro estes detalhes. Assim sabe exatamente o que está a contratar e o que é tratado à parte.'}
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
                                            {isEn ? 'Land Package Breakdown' : 'Cálculo do Valor Terrestre'}
                                        </h4>
                                        <div className="flex flex-col gap-3 text-sm text-slate-600">
                                            <div className="flex justify-between items-start gap-3">
                                                <span>{isEn ? 'Base price:' : 'Valor base:'}</span>
                                                <PilgrimagePrice amountInEur={basePrice} layout="compact" primaryClassName="text-sm font-semibold text-slate-800" secondaryClassName="text-[10px] text-slate-500" showLabels={false} />
                                            </div>
                                            <div className="flex justify-between items-start gap-3">
                                                <span>{isEn ? 'Registration fee:' : 'Taxa de inscrição:'}</span>
                                                <PilgrimagePrice amountInEur={depositValue} layout="compact" primaryClassName="text-sm font-semibold text-slate-800" secondaryClassName="text-[10px] text-slate-500" showLabels={false} />
                                            </div>
                                            <div className="pt-3 mt-1 border-t border-slate-200 flex justify-between items-start gap-3 text-slate-900">
                                                <span className="font-bold text-lg">{isEn ? 'Total Land Package:' : 'Valor Total do Terrestre:'}</span>
                                                <PilgrimagePrice amountInEur={basePrice + depositValue} layout="stacked" primaryClassName="text-lg font-bold text-slate-900" secondaryClassName="text-xs font-semibold text-slate-600" />
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
                                                        <img src={accommodationImage} alt={isEn ? 'Accommodation' : 'Alojamento'} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mb-3 text-slate-800">
                                                    <h4 className="font-bold text-base flex items-center gap-2">
                                                        {isEn ? 'Accommodation' : 'Alojamento'}
                                                        {accommodationRating && (
                                                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                                                                {accommodationRating}
                                                            </span>
                                                        )}
                                                    </h4>
                                                </div>
                                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line flex-1">
                                                    {accommodationDescription || (isEn ? 'Accommodation details not specified.' : 'Detalhes de alojamento não especificados.')}
                                                </p>
                                            </div>
                                        )}
                                        {(transportType || transportDescription) && (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden flex flex-col">
                                                {transportImage && (
                                                    <div className="w-full h-32 -mt-5 -mx-5 border-b border-slate-200 bg-slate-100 relative mb-4">
                                                        <img src={transportImage} alt={isEn ? 'Transport' : 'Transporte'} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mb-3 text-slate-800">
                                                    <h4 className="font-bold text-base flex items-center gap-2">
                                                        {isEn ? 'Transport' : 'Transporte'}
                                                        {transportType && (
                                                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                                                                {transportType}
                                                            </span>
                                                        )}
                                                    </h4>
                                                </div>
                                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line flex-1">
                                                    {transportDescription || (isEn ? 'Transport details not specified.' : 'Detalhes de transporte não especificados.')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <section aria-labelledby="land-package-contents-title">
                                    <div className="mb-4">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-700">
                                            {isEn ? 'Land package' : 'Pacote terrestre'}
                                        </p>
                                        <h3 id="land-package-contents-title" className="mt-1 text-xl font-bold text-slate-900">
                                            {isEn ? 'What the advertised price covers' : 'O que o valor apresentado inclui'}
                                        </h3>
                                        <p className="mt-1 text-sm leading-relaxed text-slate-500">
                                            {isEn
                                                ? 'Each item is separated below so it is clear what is covered and what must be arranged separately.'
                                                : 'Cada item está separado abaixo para ficar claro o que está abrangido e o que deve ser tratado à parte.'}
                                        </p>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5 md:p-6">
                                            <div className="mb-4 flex items-center justify-between gap-3 text-emerald-800">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                                                    <h4 className="text-lg font-bold">{isEn ? 'Included in the price' : 'Incluído no valor'}</h4>
                                                </div>
                                                {normalizedIncludedItems.length > 0 && (
                                                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                                                        {normalizedIncludedItems.length}
                                                    </span>
                                                )}
                                            </div>
                                            <ul className="space-y-2.5">
                                                {normalizedIncludedItems.length > 0 ? normalizedIncludedItems.map((item) => (
                                                    <li key={item} className="flex min-w-0 items-start gap-3 rounded-2xl border border-emerald-100 bg-white/90 px-3.5 py-3 text-sm font-semibold leading-5 text-slate-700 shadow-sm">
                                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                        <span className="min-w-0 break-words">{item}</span>
                                                    </li>
                                                )) : (
                                                    <li className="rounded-2xl bg-white/70 px-4 py-3 text-sm italic text-slate-500">
                                                        {isEn ? 'No additional details.' : 'Sem detalhes adicionais.'}
                                                    </li>
                                                )}
                                            </ul>
                                        </div>

                                        <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-5 md:p-6">
                                            <div className="mb-4 flex items-center justify-between gap-3 text-rose-800">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <ShieldCheck className="h-5 w-5 shrink-0" />
                                                    <h4 className="text-lg font-bold">{isEn ? 'Not included' : 'Não incluído'}</h4>
                                                </div>
                                                {normalizedNotIncludedItems.length > 0 && (
                                                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-rose-700 shadow-sm">
                                                        {normalizedNotIncludedItems.length}
                                                    </span>
                                                )}
                                            </div>
                                            <ul className="space-y-2.5">
                                                {normalizedNotIncludedItems.length > 0 ? normalizedNotIncludedItems.map((item) => (
                                                    <li key={item} className="flex min-w-0 items-start gap-3 rounded-2xl border border-rose-100 bg-white/90 px-3.5 py-3 text-sm font-semibold leading-5 text-slate-700 shadow-sm">
                                                        <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                                                        <span className="min-w-0 break-words">{item}</span>
                                                    </li>
                                                )) : (
                                                    <li className="rounded-2xl bg-white/70 px-4 py-3 text-sm italic text-slate-500">
                                                        {isEn ? 'Nothing relevant outside of the base package.' : 'Nada de relevante a assinalar fora do pacote base.'}
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </section>

                                {/* Financials & Policy */}
                                {(paymentPlanText || cancellationPolicyText) && (
                                    <div className="space-y-6 mt-8 border-t border-slate-100 pt-8">
                                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5 text-yellow-600" /> {isEn ? 'Conditions and payment / donation methods' : 'Condições e formas de pagamento / doação'}
                                        </h3>
                                        
                                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col items-center gap-4 w-full">
                                            <p className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                                                {isEn ? '100% Secure Payments' : 'Pagamentos 100% Seguros'}
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
                                                            <h4 className="font-bold text-indigo-900 mb-2">{isEn ? 'Donation Options' : 'Facilidades de Doação'}</h4>
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
                                                                {isEn ? 'Cancellation Policy' : 'Política de Cancelamento'}
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
                        ) : countryBasedFlightPolicy ? (
                            <>
                                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 md:p-6">
                                    <div className="flex items-start gap-3">
                                        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
                                        <div>
                                            <h3 className="text-lg font-black text-amber-950">
                                                {isEn ? 'The rule depends on your country of residence' : 'A regra depende do seu país de residência'}
                                            </h3>
                                            <p className="mt-2 text-sm font-medium leading-relaxed text-amber-900">
                                                {isEn
                                                    ? 'The registration form applies the correct rule automatically. There is no optional flight choice for this pilgrimage.'
                                                    : 'O formulário de inscrição aplica automaticamente a regra correta. Nesta peregrinação não existe uma escolha opcional de voo.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="rounded-3xl border-2 border-amber-200 bg-white p-6 shadow-sm">
                                        <div className="mb-4 flex items-center gap-2 text-amber-800">
                                            <Users className="h-5 w-5" />
                                            <h3 className="text-lg font-black">
                                                {isEn ? 'Residents of Portugal or Brazil' : 'Residentes em Portugal ou no Brasil'}
                                            </h3>
                                        </div>
                                        <p className="text-sm font-bold leading-relaxed text-slate-800">
                                            {isEn
                                                ? 'The agency air package is mandatory. Do not purchase these flights independently.'
                                                : 'O pacote aéreo da agência é obrigatório. Não compre estes voos por conta própria.'}
                                        </p>
                                        <ul className="mt-4 space-y-2 text-sm text-slate-700">
                                            {[
                                                isEn ? 'Country of residence → Rome' : 'País de residência → Roma',
                                                isEn ? 'Rome → Split' : 'Roma → Split',
                                                isEn ? 'Split → home destination' : 'Split → destino de regresso',
                                            ].map(item => (
                                                <li key={item} className="flex items-start gap-2">
                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                                            <div className="rounded-2xl bg-amber-50 p-4">
                                                <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                                                    {isEn ? 'Brazil estimate' : 'Estimativa Brasil'}
                                                </p>
                                                <p className="mt-1 text-xl font-black text-amber-950">
                                                    {formatFlightEstimate(countryBasedFlightPolicy.estimates_eur.BR, isEn ? 'en' : 'pt')}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl bg-amber-50 p-4">
                                                <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                                                    {isEn ? 'Portugal estimate' : 'Estimativa Portugal'}
                                                </p>
                                                <p className="mt-1 text-xl font-black text-amber-950">
                                                    {formatFlightEstimate(countryBasedFlightPolicy.estimates_eur.PT, isEn ? 'en' : 'pt')}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-xs font-bold leading-relaxed text-amber-800">
                                            {isEn
                                                ? 'Paid directly to the agency. Never added to the land-package registration total.'
                                                : 'Pago diretamente à agência. Nunca é somado ao total terrestre da inscrição.'}
                                        </p>
                                    </div>

                                    <div className="rounded-3xl border-2 border-sky-200 bg-sky-50 p-6">
                                        <div className="mb-4 flex items-center gap-2 text-sky-800">
                                            <Plane className="h-5 w-5" />
                                            <h3 className="text-lg font-black">
                                                {isEn ? 'Residents of every other country' : 'Residentes em todos os outros países'}
                                            </h3>
                                        </div>
                                        <p className="text-sm font-bold leading-relaxed text-slate-800">
                                            {isEn
                                                ? 'You must purchase your own flights and comply with all three mandatory windows.'
                                                : 'Tem de comprar as suas próprias passagens e cumprir as três janelas obrigatórias.'}
                                        </p>
                                        <ol className="mt-4 space-y-3">
                                            <li className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-slate-700">
                                                <strong className="block text-sky-800">{isEn ? '5 April 2027' : '5 de abril de 2027'}</strong>
                                                {isEn
                                                    ? `Be at ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.airport} by ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.by} (Rome local time).`
                                                    : `Estar no ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.airport} até às ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.by} (hora local de Roma).`}
                                            </li>
                                            <li className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-slate-700">
                                                <strong className="block text-sky-800">{isEn ? '14 April 2027' : '14 de abril de 2027'}</strong>
                                                {isEn ? 'Book Rome → Split for the afternoon.' : 'Reservar Roma → Split para a parte da tarde.'}
                                            </li>
                                            <li className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-slate-700">
                                                <strong className="block text-sky-800">{isEn ? '17 April 2027' : '17 de abril de 2027'}</strong>
                                                {isEn
                                                    ? 'Book Split → home destination for the afternoon.'
                                                    : 'Reservar Split → destino de regresso para a parte da tarde.'}
                                            </li>
                                        </ol>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                                        <div className="mb-4 flex items-center gap-2 text-slate-800">
                                            <Plane className="h-5 w-5" />
                                            <h3 className="text-lg font-bold">{isEn ? 'Own flight' : 'Voo próprio'}</h3>
                                        </div>
                                        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                                            {isEn ? 'Flexibility' : 'Flexibilidade'}
                                        </p>
                                        <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                                            {flightInfoText || (isEn ? 'You can arrange your own flight and meet the group at the point indicated by the organisation.' : 'Pode tratar do seu voo diretamente e encontrar-se com o grupo no ponto indicado pela organização.')}
                                        </p>
                                    </div>

                                    <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-6">
                                        <div className="mb-4 flex items-center gap-2 text-indigo-800">
                                            <Users className="h-5 w-5" />
                                            <h3 className="text-lg font-bold">{isEn ? 'Group flight' : 'Voo de grupo'}</h3>
                                        </div>
                                        {flightPriceFrom ? (
                                            <>
                                                <p className="mb-4 text-sm leading-relaxed text-indigo-900">
                                                    {isEn ? 'If you prefer, you can travel on the flight organised by the agency. This price is separate from the land package.' : 'Se preferir, pode seguir no voo organizado pela agência. Este valor é separado do terrestre.'}
                                                </p>
                                                {groupFlightDetails && (
                                                    <div className="mb-4 rounded-2xl border border-indigo-100 bg-white/80 p-4 text-sm leading-relaxed text-indigo-900 whitespace-pre-line">
                                                        {groupFlightDetails}
                                                    </div>
                                                )}
                                                <div className="rounded-2xl bg-white p-4 shadow-sm">
                                                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-500">
                                                        {isEn ? 'Reference price' : 'Valor de referência'}
                                                    </p>
                                                    <PilgrimagePrice
                                                        amountInEur={flightPriceFrom}
                                                        layout="stacked"
                                                        primaryClassName="text-3xl font-black text-indigo-700"
                                                        secondaryClassName="text-sm font-semibold text-indigo-500"
                                                    />
                                                    <p className="mt-2 text-xs leading-relaxed text-indigo-500">
                                                        {isEn ? 'This payment is handled directly with the partner agency.' : 'Este pagamento é tratado diretamente com a agência parceira.'}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm leading-relaxed text-slate-600">
                                                {isEn ? 'There is currently no group flight option published for this pilgrimage.' : 'Nesta peregrinação não há neste momento uma opção de voo de grupo publicada.'}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {(meetingPointText || meetingEndText) && (
                                    <div className="rounded-3xl border border-slate-200 bg-white p-6">
                                        <div className="mb-4 flex items-center gap-2 text-slate-800">
                                            <MapPin className="h-5 w-5" />
                                            <h3 className="text-lg font-bold">{isEn ? 'Meeting point & return' : 'Encontro e regresso'}</h3>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {meetingPointText && (
                                                <div className="rounded-2xl bg-slate-50 p-4">
                                                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-600">{isEn ? 'Meeting point' : 'Ponto de encontro'}</p>
                                                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{meetingPointText}</p>
                                                </div>
                                            )}
                                            {meetingEndText && (
                                                <div className="rounded-2xl bg-slate-50 p-4">
                                                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-500">{isEn ? 'End of trip' : 'Fim da viagem'}</p>
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
                                    ? (isEn ? 'If it is clear, return to the form and continue with the registration.' : 'Se ficou claro, volte ao formulário e avance com a inscrição.')
                                    : countryBasedFlightPolicy
                                        ? (isEn ? 'In the registration form, read and confirm the mandatory rule for each pilgrim.' : 'No formulário, leia e confirme a regra obrigatória de cada peregrino.')
                                        : (isEn ? 'First confirm the flight option. Then continue with the registration.' : 'Primeiro confirme a opção de voo. Depois avance com a inscrição.')}
                            </p>
                            <div className="flex flex-col gap-2 md:flex-row">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    {isEn ? 'Close' : 'Fechar'}
                                </button>
                                <Link
                                    href={registrationLink}
                                    onClick={onClose}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-slate-950 transition-colors hover:bg-yellow-500"
                                >
                                    {isEn ? 'I want to register' : 'Quero inscrever-me'}
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
