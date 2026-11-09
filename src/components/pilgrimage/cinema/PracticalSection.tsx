"use client";

import { ArrowUpRight } from 'lucide-react';
import { MaskText, Reveal } from './primitives';
import CtaButton from './CtaButton';
import type { BookingCta, BookingSummary } from './types';

type Row = {
    label: string;
    value: string;
    hint?: string;
    onClick?: () => void;
};

/** Preço inline (só mobile/tablet; no desktop o painel lateral já o mostra). */
export function PriceBlock({ summary, isEn, tone = 'light' }: { summary: BookingSummary; isEn: boolean; tone?: 'light' | 'night' }) {
    return (
        <div className={`pg-price ${tone === 'night' ? 'is-night' : ''}`}>
            <p className="pg-meta text-[var(--pg-ink-muted)]">{isEn ? 'From / person · flight not included' : 'Desde / pessoa · voo não incluído'}</p>
            <p className="pg-price-row">
                <span className="pg-display pg-price-value">{summary.startingEUR}</span>
                {summary.startingConverted && <span className="pg-price-converted">≈ {summary.startingConverted}</span>}
            </p>
            <p className="pg-price-breakdown">
                {summary.baseEUR} {isEn ? 'land package' : 'terrestre'} + {summary.depositEUR} {isEn ? 'registration' : 'inscrição'}
            </p>
            <p className="pg-meta pg-price-terms">
                <span>{isEn ? 'Contract price in EUR' : 'Preço contratual em EUR'}</span>
                {summary.startingConverted && <span>· {summary.currency} {isEn ? "today's rate" : 'câmbio do dia'}</span>}
                <span aria-hidden>·</span>
                <span className="text-[var(--pg-ink)]">{isEn ? `up to ${summary.maxInstallments} instalments` : `até ${summary.maxInstallments} prestações`}</span>
            </p>
            {summary.currency !== 'EUR' && (
                <p className="pg-price-note">
                    {isEn ? `* ${summary.currency} is indicative · contract price in EUR` : `* ${summary.currency} indicativo · preço contratual em EUR`}
                </p>
            )}
        </div>
    );
}

export default function PracticalSection({
    summary,
    cta,
    accommodation,
    transport,
    returnLabel,
    isEn,
}: {
    summary: BookingSummary;
    cta: BookingCta;
    accommodation?: string;
    transport?: string;
    returnLabel: string;
    isEn: boolean;
}) {
    const rows: Row[] = [];
    if (summary.hasIncludedInfo) {
        rows.push({
            label: isEn ? 'Included' : 'Incluído',
            value: isEn ? "What's included in the land package" : 'O que está incluído no terrestre',
            hint: isEn ? 'What is and is not included in the price.' : 'Incluído e não incluído no valor.',
            onClick: summary.onOpenIncluded,
        });
    }
    if (summary.hasFlightInfo) {
        rows.push({ label: isEn ? 'Flights' : 'Voos', value: summary.flightsLabel, hint: summary.flightsHint, onClick: summary.onOpenFlights });
    }
    if (accommodation) {
        rows.push({ label: isEn ? 'Accommodation' : 'Alojamento', value: accommodation, onClick: summary.hasIncludedInfo ? summary.onOpenIncluded : undefined });
    }
    if (transport) {
        rows.push({ label: isEn ? 'Transport' : 'Transporte', value: transport, onClick: summary.hasIncludedInfo ? summary.onOpenIncluded : undefined });
    }
    rows.push({
        label: isEn ? 'Payment' : 'Pagamento',
        value: isEn ? `Up to ${summary.maxInstallments} instalments` : `Até ${summary.maxInstallments} prestações`,
        hint: isEn ? 'Contract price in EUR.' : 'Preço contratual em EUR.',
    });
    rows.push({ label: isEn ? 'Dates' : 'Datas', value: `${summary.departureLabel} — ${returnLabel}` });
    if (summary.deadlineLabel) {
        rows.push({ label: isEn ? 'Registrations until' : 'Inscrições até', value: summary.deadlineLabel });
    }

    return (
        <section id="pricing" className="pg-practical pg-paper" aria-labelledby="pg-practical-heading">
            <div id="trip-details" className="pg-wrap pg-wrap-docked">
                <Reveal>
                    <p className="pg-meta pg-eyebrow text-[var(--pg-ink-muted)]">{isEn ? 'Before you go' : 'Antes de partir'}</p>
                </Reveal>
                <h2 id="pg-practical-heading" className="pg-display pg-section-title">
                    <MaskText text={isEn ? 'Price and practical details.' : 'Preço e detalhes práticos.'} />
                </h2>

                <Reveal className="pg-practical-price">
                    <PriceBlock summary={summary} isEn={isEn} />
                    {summary.lastSpots && (
                        <p className="pg-meta pg-last-spots"><span className="pg-dot bg-red-500" aria-hidden /> {isEn ? 'Last spots — almost fully booked' : 'Últimos lugares — quase esgotado'}</p>
                    )}
                    <CtaButton cta={cta} placement="pricing" className="w-full sm:w-auto" />
                </Reveal>

                <ul className="pg-rows">
                    {rows.map((row, i) => {
                        const inner = (
                            <>
                                <span className="pg-meta pg-row-label">{row.label}</span>
                                <span className="pg-row-main">
                                    <span className="pg-row-value">{row.value}</span>
                                    {row.hint && <span className="pg-row-hint">{row.hint}</span>}
                                </span>
                                {row.onClick && <ArrowUpRight className="pg-row-arrow" size={20} aria-hidden />}
                            </>
                        );
                        return (
                            <Reveal as="li" key={row.label} delay={i * 0.05}>
                                {row.onClick ? (
                                    <button type="button" className="pg-row is-action" onClick={row.onClick}>{inner}</button>
                                ) : (
                                    <div className="pg-row">{inner}</div>
                                )}
                            </Reveal>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}
