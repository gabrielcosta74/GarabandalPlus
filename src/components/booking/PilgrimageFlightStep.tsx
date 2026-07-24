"use client";

import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    CheckCircle2,
    MapPin,
    Plane,
} from 'lucide-react';
import {
    CountryBasedFlightPolicy,
    deriveFlightOption,
    formatFlightEstimate,
    getFlightEstimate,
    normalizeResidenceCountryCode,
} from '../../lib/pilgrimage-flight-policy';

type PilgrimFlightSummary = {
    full_name?: string | null;
    country?: string | null;
};

type PilgrimageFlightStepProps = {
    pilgrims: PilgrimFlightSummary[];
    policy: CountryBasedFlightPolicy;
    acknowledgements: Record<number, boolean>;
    onAcknowledgementChange: (index: number, acknowledged: boolean) => void;
    onBack: () => void;
    onContinue: () => void;
    isEn: boolean;
};

const formatCountryName = (countryCode: string | null, isEn: boolean) => {
    if (!countryCode) return isEn ? 'Unknown country' : 'País não identificado';
    try {
        return new Intl.DisplayNames(isEn ? 'en' : 'pt-PT', { type: 'region' }).of(countryCode) || countryCode;
    } catch {
        return countryCode;
    }
};

const formatScheduleDate = (date: string, isEn: boolean) => {
    const parsed = new Date(`${date}T12:00:00Z`);
    return new Intl.DateTimeFormat(isEn ? 'en-GB' : 'pt-PT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(parsed);
};

export default function PilgrimageFlightStep({
    pilgrims,
    policy,
    acknowledgements,
    onAcknowledgementChange,
    onBack,
    onContinue,
    isEn,
}: PilgrimageFlightStepProps) {
    const allAcknowledged = pilgrims.length > 0 && pilgrims.every((_, index) => acknowledgements[index]);

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-center md:p-7">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500 text-slate-950">
                    <Plane className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
                    {isEn ? 'Mandatory information' : 'Informação obrigatória'}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
                    {isEn ? 'Your flight arrangements' : 'A organização dos seus voos'}
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
                    {isEn
                        ? 'The rule is determined automatically from each pilgrim’s country of residence. Read every card carefully and confirm that you understand it.'
                        : 'A regra é determinada automaticamente pelo país de residência de cada peregrino. Leia cada cartão com atenção e confirme que compreendeu.'}
                </p>
            </div>

            <div className="space-y-5">
                {pilgrims.map((pilgrim, index) => {
                    const countryCode = normalizeResidenceCountryCode(pilgrim.country);
                    const flightOption = deriveFlightOption(pilgrim.country, policy);
                    const countryName = formatCountryName(countryCode, isEn);
                    const pilgrimName = pilgrim.full_name?.trim() || `${isEn ? 'Person' : 'Pessoa'} ${index + 1}`;

                    if (!flightOption) {
                        return (
                            <div key={`${pilgrimName}-${index}`} className="rounded-3xl border-2 border-red-500 bg-red-500/10 p-5">
                                <p className="font-bold text-red-300">
                                    {isEn
                                        ? `${pilgrimName}: return to the previous step and select a valid country of residence.`
                                        : `${pilgrimName}: volte ao passo anterior e escolha um país de residência válido.`}
                                </p>
                            </div>
                        );
                    }

                    const isAgencyRequired = flightOption === 'agency';
                    const estimate = getFlightEstimate(pilgrim.country, policy);

                    return (
                        <section
                            key={`${pilgrimName}-${index}`}
                            className={`overflow-hidden rounded-3xl border-2 ${
                                isAgencyRequired
                                    ? 'border-amber-400/70 bg-amber-500/10'
                                    : 'border-sky-400/60 bg-sky-500/10'
                            }`}
                        >
                            <div className="border-b border-white/10 p-5 md:p-6">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                                            {pilgrimName} · {countryName}
                                        </p>
                                        <h3 className={`mt-1 text-xl font-black ${isAgencyRequired ? 'text-amber-300' : 'text-sky-300'}`}>
                                            {isAgencyRequired
                                                ? (isEn ? 'The agency air package is mandatory for you' : 'Para si, o pacote aéreo da agência é obrigatório')
                                                : (isEn ? 'You must arrange your own flights' : 'Tem de comprar as suas próprias passagens')}
                                        </h3>
                                    </div>
                                    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                                        isAgencyRequired
                                            ? 'bg-amber-400 text-amber-950'
                                            : 'bg-sky-400 text-sky-950'
                                    }`}>
                                        {isAgencyRequired
                                            ? (isEn ? 'Partner agency' : 'Agência parceira')
                                            : (isEn ? 'Own flights' : 'Voos próprios')}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-5 p-5 md:p-6">
                                {isAgencyRequired ? (
                                    <>
                                        <p className="text-sm leading-relaxed text-slate-200 md:text-base">
                                            {isEn
                                                ? 'Because you live in Portugal or Brazil, do not purchase these flights independently. The air package will be arranged through the travel agency appointed by the Apostolate.'
                                                : 'Como reside em Portugal ou no Brasil, não compre estes voos por conta própria. O pacote aéreo será tratado através da agência de viagens indicada pelo Apostolado.'}
                                        </p>

                                        <div>
                                            <p className="mb-3 text-xs font-black uppercase tracking-wider text-amber-300">
                                                {isEn ? 'The package includes' : 'O pacote inclui'}
                                            </p>
                                            <ul className="space-y-3">
                                                {[
                                                    isEn ? 'Country of residence → Rome' : 'País de residência → Roma',
                                                    isEn ? 'Rome → Split' : 'Roma → Split',
                                                    isEn ? 'Split → home destination' : 'Split → destino de regresso',
                                                ].map(item => (
                                                    <li key={item} className="flex items-start gap-3 text-sm font-semibold text-white">
                                                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="rounded-2xl border border-amber-400/30 bg-slate-950/50 p-4">
                                            <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                                                {isEn ? 'Estimated airfare' : 'Estimativa do aéreo'}
                                            </p>
                                            <p className="mt-1 text-2xl font-black text-white">
                                                {formatFlightEstimate(estimate, isEn ? 'en' : 'pt')}
                                            </p>
                                            <p className="mt-2 text-sm font-semibold leading-relaxed text-amber-100">
                                                {isEn
                                                    ? 'Paid directly to the agency. It is not charged in this registration and does not change the land-package total.'
                                                    : 'Pago diretamente à agência. Não é cobrado nesta inscrição e não altera o total terrestre.'}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm leading-relaxed text-slate-200 md:text-base">
                                            {isEn
                                                ? 'Because you live outside Portugal and Brazil, you are responsible for purchasing all your flights. They must comply with these three mandatory windows.'
                                                : 'Como reside fora de Portugal e do Brasil, é responsável por comprar todas as suas passagens. Elas têm de respeitar estas três janelas obrigatórias.'}
                                        </p>

                                        <ol className="space-y-3">
                                            <li className="flex gap-3 rounded-2xl border border-sky-400/20 bg-slate-950/40 p-4">
                                                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden="true" />
                                                <div>
                                                    <p className="font-black text-white">
                                                        {formatScheduleDate(policy.own_flight_schedule.rome_arrival.date, isEn)}
                                                    </p>
                                                    <p className="mt-1 text-sm leading-relaxed text-slate-300">
                                                        {isEn
                                                            ? `Be at ${policy.own_flight_schedule.rome_arrival.airport} by ${policy.own_flight_schedule.rome_arrival.by} (Rome local time).`
                                                            : `Estar no ${policy.own_flight_schedule.rome_arrival.airport} até às ${policy.own_flight_schedule.rome_arrival.by} (hora local de Roma).`}
                                                    </p>
                                                </div>
                                            </li>
                                            <li className="flex gap-3 rounded-2xl border border-sky-400/20 bg-slate-950/40 p-4">
                                                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden="true" />
                                                <div>
                                                    <p className="font-black text-white">
                                                        {formatScheduleDate(policy.own_flight_schedule.rome_split.date, isEn)}
                                                    </p>
                                                    <p className="mt-1 text-sm leading-relaxed text-slate-300">
                                                        {isEn ? 'Book Rome → Split for the afternoon.' : 'Reservar Roma → Split para a parte da tarde.'}
                                                    </p>
                                                </div>
                                            </li>
                                            <li className="flex gap-3 rounded-2xl border border-sky-400/20 bg-slate-950/40 p-4">
                                                <Plane className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden="true" />
                                                <div>
                                                    <p className="font-black text-white">
                                                        {formatScheduleDate(policy.own_flight_schedule.split_home.date, isEn)}
                                                    </p>
                                                    <p className="mt-1 text-sm leading-relaxed text-slate-300">
                                                        {isEn
                                                            ? 'Book Split → home destination for the afternoon.'
                                                            : 'Reservar Split → destino de regresso para a parte da tarde.'}
                                                    </p>
                                                </div>
                                            </li>
                                        </ol>
                                    </>
                                )}

                                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                                    acknowledgements[index]
                                        ? 'border-emerald-400/60 bg-emerald-500/10'
                                        : 'border-white/15 bg-slate-950/40 hover:border-white/30'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(acknowledgements[index])}
                                        onChange={event => onAcknowledgementChange(index, event.target.checked)}
                                        className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
                                    />
                                    <span className="text-sm font-semibold leading-relaxed text-slate-200">
                                        {isAgencyRequired
                                            ? (isEn
                                                ? 'I have read and understand that I must purchase this air package directly from the agency indicated by the Apostolate.'
                                                : 'Li e compreendi que tenho de contratar este pacote aéreo diretamente com a agência indicada pelo Apostolado.')
                                            : (isEn
                                                ? 'I have read and understand the three mandatory flight windows and accept responsibility for purchasing my flights.'
                                                : 'Li e compreendi as três janelas obrigatórias e assumo a compra das minhas passagens aéreas.')}
                                    </span>
                                </label>
                            </div>
                        </section>
                    );
                })}
            </div>

            {!allAcknowledged && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-semibold leading-relaxed text-amber-200">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    {isEn
                        ? 'Confirm the flight information for every pilgrim before continuing.'
                        : 'Confirme a informação de voos de todos os peregrinos antes de continuar.'}
                </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    {isEn ? 'Back to accommodation' : 'Voltar ao alojamento'}
                </button>
                <button
                    type="button"
                    onClick={onContinue}
                    disabled={!allAcknowledged}
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-500 px-7 font-black text-slate-950 shadow-xl shadow-yellow-500/20 transition-all hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isEn ? 'Continue to final summary' : 'Continuar para o resumo final'}
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
