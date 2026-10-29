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
            <div className="reg-step-head" style={{ marginBottom: 4 }}>
                <p className="reg-eyebrow">
                    <Plane className="h-4 w-4" aria-hidden="true" />
                    {isEn ? 'Mandatory information' : 'Informação obrigatória'}
                </p>
                <h2>
                    {isEn ? 'Your flight arrangements' : 'A organização dos seus voos'}
                </h2>
                <p>
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
                            <div key={`${pilgrimName}-${index}`} className="rounded-3xl border-2 border-[#c0392b] bg-[#fdf0ee] p-5">
                                <p className="font-bold text-[#c0392b]">
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
                                    ? 'border-[#11295a]/40 bg-[#eef2f9]'
                                    : 'border-[#cfd3da] bg-[#f6f7f9]'
                            }`}
                        >
                            <div className="border-b border-black/5 p-5 md:p-6">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-[#5f6672]">
                                            {pilgrimName} · {countryName}
                                        </p>
                                        <h3 className={`mt-1 text-xl font-semibold ${isAgencyRequired ? 'text-[#11295a]' : 'text-[#11295a]'}`}>
                                            {isAgencyRequired
                                                ? (isEn ? 'The agency air package is mandatory for you' : 'Para si, o pacote aéreo da agência é obrigatório')
                                                : (isEn ? 'You must arrange your own flights' : 'Tem de comprar as suas próprias passagens')}
                                        </h3>
                                    </div>
                                    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                                        isAgencyRequired
                                            ? 'bg-[#e6e8ec] text-[#0b0d12]'
                                            : 'bg-[#e6ebf4] text-[#11295a]'
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
                                        <p className="text-sm leading-relaxed text-[#2a2f38] md:text-base">
                                            {isEn
                                                ? 'Because you live in Portugal or Brazil, do not purchase these flights independently. The air package will be arranged through the travel agency appointed by the Apostolate.'
                                                : 'Como reside em Portugal ou no Brasil, não compre estes voos por conta própria. O pacote aéreo será tratado através da agência de viagens indicada pelo Apostolado.'}
                                        </p>

                                        <div>
                                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#11295a]">
                                                {isEn ? 'The package includes' : 'O pacote inclui'}
                                            </p>
                                            <ul className="space-y-3">
                                                {[
                                                    isEn ? 'Country of residence → Rome' : 'País de residência → Roma',
                                                    isEn ? 'Rome → Split' : 'Roma → Split',
                                                    isEn ? 'Split → home destination' : 'Split → destino de regresso',
                                                ].map(item => (
                                                    <li key={item} className="flex items-start gap-3 text-sm font-semibold text-[#0b0d12]">
                                                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#11295a]" aria-hidden="true" />
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="rounded-2xl border border-[#e6e8ec] bg-white p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-[#11295a]">
                                                {isEn ? 'Estimated airfare' : 'Estimativa do aéreo'}
                                            </p>
                                            <p className="mt-1 text-2xl font-semibold text-[#0b0d12]">
                                                {formatFlightEstimate(estimate, isEn ? 'en' : 'pt')}
                                            </p>
                                            <p className="mt-2 text-sm font-semibold leading-relaxed text-[#0b0d12]">
                                                {isEn
                                                    ? 'Paid directly to the agency. It is not charged in this registration and does not change the land-package total.'
                                                    : 'Pago diretamente à agência. Não é cobrado nesta inscrição e não altera o total terrestre.'}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm leading-relaxed text-[#2a2f38] md:text-base">
                                            {isEn
                                                ? 'Because you live outside Portugal and Brazil, you are responsible for purchasing all your flights. They must comply with these three mandatory windows.'
                                                : 'Como reside fora de Portugal e do Brasil, é responsável por comprar todas as suas passagens. Elas têm de respeitar estas três janelas obrigatórias.'}
                                        </p>

                                        <ol className="space-y-3">
                                            <li className="flex gap-3 rounded-2xl border border-[#e6ebf4] bg-white p-4">
                                                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#11295a]" aria-hidden="true" />
                                                <div>
                                                    <p className="font-semibold text-[#0b0d12]">
                                                        {formatScheduleDate(policy.own_flight_schedule.rome_arrival.date, isEn)}
                                                    </p>
                                                    <p className="mt-1 text-sm leading-relaxed text-[#2a2f38]">
                                                        {isEn
                                                            ? `Be at ${policy.own_flight_schedule.rome_arrival.airport} by ${policy.own_flight_schedule.rome_arrival.by} (Rome local time).`
                                                            : `Estar no ${policy.own_flight_schedule.rome_arrival.airport} até às ${policy.own_flight_schedule.rome_arrival.by} (hora local de Roma).`}
                                                    </p>
                                                </div>
                                            </li>
                                            <li className="flex gap-3 rounded-2xl border border-[#e6ebf4] bg-white p-4">
                                                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#11295a]" aria-hidden="true" />
                                                <div>
                                                    <p className="font-semibold text-[#0b0d12]">
                                                        {formatScheduleDate(policy.own_flight_schedule.rome_split.date, isEn)}
                                                    </p>
                                                    <p className="mt-1 text-sm leading-relaxed text-[#2a2f38]">
                                                        {isEn ? 'Book Rome → Split for the afternoon.' : 'Reservar Roma → Split para a parte da tarde.'}
                                                    </p>
                                                </div>
                                            </li>
                                            <li className="flex gap-3 rounded-2xl border border-[#e6ebf4] bg-white p-4">
                                                <Plane className="mt-0.5 h-5 w-5 shrink-0 text-[#11295a]" aria-hidden="true" />
                                                <div>
                                                    <p className="font-semibold text-[#0b0d12]">
                                                        {formatScheduleDate(policy.own_flight_schedule.split_home.date, isEn)}
                                                    </p>
                                                    <p className="mt-1 text-sm leading-relaxed text-[#2a2f38]">
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
                                        ? 'border-[#1f6b46] bg-[#ebf5ef]'
                                        : 'border-[#cfd3da] bg-white hover:border-[#a9afb9]'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(acknowledgements[index])}
                                        onChange={event => onAcknowledgementChange(index, event.target.checked)}
                                        className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f6b46]"
                                    />
                                    <span className="text-sm font-semibold leading-relaxed text-[#2a2f38]">
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
                <div className="flex items-start gap-3 rounded-2xl border border-[#e6e8ec] bg-[#f6f7f9] p-4 text-sm font-semibold leading-relaxed text-[#11295a]">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    {isEn
                        ? 'Confirm the flight information for every pilgrim before continuing.'
                        : 'Confirme a informação de voos de todos os peregrinos antes de continuar.'}
                </div>
            )}

            <div className="reg-actions">
                <button
                    type="button"
                    onClick={onBack}
                    className="reg-ghost"
                >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    {isEn ? 'Back to accommodation' : 'Voltar ao alojamento'}
                </button>
                <button
                    type="button"
                    onClick={onContinue}
                    disabled={!allAcknowledged}
                    className="reg-primary"
                >
                    {isEn ? 'Continue to final summary' : 'Continuar para o resumo final'}
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
