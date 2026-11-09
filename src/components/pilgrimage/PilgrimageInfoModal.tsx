"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Minus, Plus, X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { PilgrimagePrice } from './PilgrimagePrice';
import RichText from './RichText';
import { pgFontVariables } from './cinema/fonts';
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

const EASE_CINE = [0.76, 0, 0.24, 1] as const;

function useIsMobile() {
    const [mobile, setMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const sync = () => setMobile(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);
    return mobile;
}

/** Cabeçalho de bloco dentro do modal. */
function BlockTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
    return (
        <div className="pg-modal-block-head">
            <h3 className="pg-display pg-modal-block-title">{children}</h3>
            {aside}
        </div>
    );
}

/** Lista de itens incluídos/não incluídos. */
function ItemList({ items, kind, empty }: { items: string[]; kind: 'yes' | 'no'; empty: string }) {
    if (items.length === 0) return <p className="pg-modal-empty">{empty}</p>;
    return (
        <ul className="pg-modal-list">
            {items.map((item) => (
                <li key={item} className={kind === 'yes' ? 'is-yes' : 'is-no'}>
                    <span className="pg-modal-list-icon" aria-hidden>
                        {kind === 'yes' ? <Check size={13} strokeWidth={2.5} /> : <Minus size={13} strokeWidth={2.5} />}
                    </span>
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

/**
 * Modal "Informação importante": o que está incluído no valor terrestre e as
 * opções/regras de voo. Mobile: sheet que sobe de baixo. Desktop: painel centrado.
 * Só apresentação: os valores vêm do PilgrimagePrice e o link de inscrição da página.
 */
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
    transportImage,
}: PilgrimageInfoModalProps) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const reduce = useReducedMotion();
    const mobile = useIsMobile();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrolled, setScrolled] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!isOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            setScrolled(false);
            scrollRef.current?.scrollTo({ top: 0 });
        }
    }, [isOpen, mode]);

    const isIncludedMode = mode === 'included';
    const countryBasedFlightPolicy = parseCountryBasedFlightPolicy(flightRegistrationPolicy);
    const normalizedIncludedItems = normalizeListItems(includedItems);
    const normalizedNotIncludedItems = normalizeListItems(notIncludedItems);

    const title = isIncludedMode
        ? (isEn ? 'Included in the land package' : 'Incluído no valor terrestre')
        : countryBasedFlightPolicy
            ? (isEn ? 'Mandatory flight rules' : 'Regras obrigatórias dos voos')
            : (isEn ? 'Flight options' : 'Opções de voo');
    const subtitle = isIncludedMode
        ? (isEn ? 'See exactly what is included in the advertised price before you continue.' : 'Veja exatamente o que está incluído no valor apresentado antes de avançar.')
        : (isEn ? 'See how the flights work and what is paid separately.' : 'Veja como funcionam os voos e o que é pago à parte.');
    const footerHint = isIncludedMode
        ? (isEn ? 'If it is clear, return to the form and continue with the registration.' : 'Se ficou claro, volte ao formulário e avance com a inscrição.')
        : countryBasedFlightPolicy
            ? (isEn ? 'In the registration form, read and confirm the mandatory rule for each pilgrim.' : 'No formulário, leia e confirme a regra obrigatória de cada peregrino.')
            : (isEn ? 'First confirm the flight option. Then continue with the registration.' : 'Primeiro confirme a opção de voo. Depois avance com a inscrição.');

    const panelMotion = reduce
        ? {}
        : mobile
            ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { duration: 0.55, ease: EASE_CINE } }
            : { initial: { opacity: 0, y: 24, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.98 }, transition: { duration: 0.5, ease: EASE_CINE } };

    if (!mounted) return null;

    // Em portal no body: fica sempre por cima do painel de inscrição (também em portal).
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className={`pg-scope ${pgFontVariables} pg-modal-root`} key="pg-info-modal">
                    <motion.button
                        type="button"
                        aria-label={isEn ? 'Close' : 'Fechar'}
                        onClick={onClose}
                        className="pg-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                    />

                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="pg-modal-title"
                        className="pg-modal"
                        {...panelMotion}
                    >
                        {/* Cabeçalho fixo */}
                        <div className={`pg-modal-head ${scrolled ? 'is-scrolled' : ''}`}>
                            <span className="pg-modal-handle" aria-hidden />
                            <div className="pg-modal-head-text">
                                <p className="pg-meta pg-eyebrow text-[var(--pg-ink-muted)]">{isEn ? 'Important information' : 'Informação importante'}</p>
                                <h2 id="pg-modal-title" className="pg-display pg-modal-title">{title}</h2>
                            </div>
                            <button type="button" onClick={onClose} className="pg-modal-close" aria-label={isEn ? 'Close' : 'Fechar'}>
                                <X size={18} aria-hidden />
                            </button>
                        </div>

                        {/* Conteúdo */}
                        <div ref={scrollRef} className="pg-modal-body" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}>
                            <p className="pg-modal-subtitle">{subtitle}</p>

                            <div className="pg-modal-notice">
                                <p>
                                    <strong>{isEn ? 'To avoid doubts. ' : 'Para evitar dúvidas. '}</strong>
                                    {isEn ? 'The main price of this pilgrimage is the land package. Flights are not included in this base price.' : 'O valor principal desta peregrinação é o valor do terrestre. O voo não está incluído nesse valor base.'}
                                </p>
                                <p>
                                    <strong>{isEn ? 'Before paying. ' : 'Antes de pagar. '}</strong>
                                    {isEn ? 'Please confirm these details first. That way you know exactly what you are booking and what is handled separately.' : 'Confirme primeiro estes detalhes. Assim sabe exatamente o que está a contratar e o que é tratado à parte.'}
                                </p>
                            </div>

                            {isIncludedMode ? (
                                <>
                                    {typeof basePrice === 'number' && typeof depositValue === 'number' && (
                                        <section className="pg-modal-block">
                                            <BlockTitle>{isEn ? 'Land package breakdown' : 'Cálculo do valor terrestre'}</BlockTitle>
                                            <dl className="pg-modal-sum">
                                                <div>
                                                    <dt>{isEn ? 'Base price' : 'Valor base'}</dt>
                                                    <dd><PilgrimagePrice amountInEur={basePrice} layout="compact" primaryClassName="text-[15px] font-medium text-[var(--pg-ink)]" secondaryClassName="text-[11px] text-[var(--pg-ink-muted)]" showLabels={false} /></dd>
                                                </div>
                                                <div>
                                                    <dt>{isEn ? 'Registration fee' : 'Taxa de inscrição'}</dt>
                                                    <dd><PilgrimagePrice amountInEur={depositValue} layout="compact" primaryClassName="text-[15px] font-medium text-[var(--pg-ink)]" secondaryClassName="text-[11px] text-[var(--pg-ink-muted)]" showLabels={false} /></dd>
                                                </div>
                                                <div className="is-total">
                                                    <dt>{isEn ? 'Total land package' : 'Valor total do terrestre'}</dt>
                                                    <dd><PilgrimagePrice amountInEur={basePrice + depositValue} layout="stacked" primaryClassName="pg-display text-[1.9rem] text-[var(--pg-ink)]" secondaryClassName="text-xs font-medium text-[var(--pg-ink-muted)]" fixedLabelClassName="text-[11px] font-medium normal-case tracking-normal text-[var(--pg-ink-faint)]" variableLabelClassName="text-[11px] font-medium normal-case tracking-normal text-[var(--pg-ink-faint)]" /></dd>
                                                </div>
                                            </dl>
                                        </section>
                                    )}

                                    <section className="pg-modal-block" aria-labelledby="land-package-contents-title">
                                        <BlockTitle>
                                            <span id="land-package-contents-title">{isEn ? 'What the advertised price covers' : 'O que o valor apresentado inclui'}</span>
                                        </BlockTitle>
                                        <p className="pg-modal-note">
                                            {isEn
                                                ? 'Each item is separated below so it is clear what is covered and what must be arranged separately.'
                                                : 'Cada item está separado abaixo para ficar claro o que está abrangido e o que deve ser tratado à parte.'}
                                        </p>
                                        <div className="pg-modal-cols">
                                            <div className="pg-modal-card">
                                                <BlockTitle aside={normalizedIncludedItems.length > 0 ? <span className="pg-modal-count">{normalizedIncludedItems.length}</span> : null}>
                                                    {isEn ? 'Included in the price' : 'Incluído no valor'}
                                                </BlockTitle>
                                                <ItemList items={normalizedIncludedItems} kind="yes" empty={isEn ? 'No additional details.' : 'Sem detalhes adicionais.'} />
                                            </div>
                                            <div className="pg-modal-card is-muted">
                                                <BlockTitle aside={normalizedNotIncludedItems.length > 0 ? <span className="pg-modal-count">{normalizedNotIncludedItems.length}</span> : null}>
                                                    {isEn ? 'Not included' : 'Não incluído'}
                                                </BlockTitle>
                                                <ItemList items={normalizedNotIncludedItems} kind="no" empty={isEn ? 'Nothing relevant outside of the base package.' : 'Nada de relevante a assinalar fora do pacote base.'} />
                                            </div>
                                        </div>
                                    </section>

                                    {((accommodationRating || accommodationDescription) || (transportType || transportDescription)) && (
                                        <section className="pg-modal-block">
                                            <div className="pg-modal-cols">
                                                {(accommodationRating || accommodationDescription) && (
                                                    <article className="pg-modal-media-card">
                                                        {accommodationImage && (
                                                            <div className="pg-modal-media"><img src={accommodationImage} alt={isEn ? 'Accommodation' : 'Alojamento'} loading="lazy" /></div>
                                                        )}
                                                        <div className="pg-modal-media-body">
                                                            <p className="pg-modal-kicker">{isEn ? 'Accommodation' : 'Alojamento'}</p>
                                                            {accommodationRating && <h4 className="pg-display pg-modal-media-title">{accommodationRating}</h4>}
                                                            <RichText
                                                                value={accommodationDescription || (isEn ? 'Accommodation details not specified.' : 'Detalhes de alojamento não especificados.')}
                                                                className="pg-modal-rich"
                                                            />
                                                        </div>
                                                    </article>
                                                )}
                                                {(transportType || transportDescription) && (
                                                    <article className="pg-modal-media-card">
                                                        {transportImage && (
                                                            <div className="pg-modal-media"><img src={transportImage} alt={isEn ? 'Transport' : 'Transporte'} loading="lazy" /></div>
                                                        )}
                                                        <div className="pg-modal-media-body">
                                                            <p className="pg-modal-kicker">{isEn ? 'Transport' : 'Transporte'}</p>
                                                            {transportType && <h4 className="pg-display pg-modal-media-title">{transportType}</h4>}
                                                            <RichText
                                                                value={transportDescription || (isEn ? 'Transport details not specified.' : 'Detalhes de transporte não especificados.')}
                                                                className="pg-modal-rich"
                                                            />
                                                        </div>
                                                    </article>
                                                )}
                                            </div>
                                        </section>
                                    )}

                                    {(paymentPlanText || cancellationPolicyText) && (
                                        <section className="pg-modal-block">
                                            <BlockTitle>{isEn ? 'Conditions and payment methods' : 'Condições e formas de pagamento'}</BlockTitle>

                                            <div className="pg-modal-pay">
                                                <p className="pg-modal-kicker">{isEn ? '100% secure payments' : 'Pagamentos 100% seguros'}</p>
                                                <div className="pg-modal-pay-logos">
                                                    <span title="Multibanco"><img src="/payment-icons/multibanco.svg" alt="Multibanco" className="h-5" /></span>
                                                    <span title="MB WAY"><img src="/payment-icons/mbway.svg" alt="MB Way" className="h-5" /></span>
                                                    <span title="Visa"><img src="/payment-icons/visa.svg" alt="Visa" className="h-3.5" /></span>
                                                    <span title="Mastercard"><img src="/payment-icons/mastercard.svg" alt="Mastercard" className="h-6" /></span>
                                                    <span title="PIX" className="is-wide"><img src="/payment-icons/pix-original.png" alt="PIX" className="h-5" /><em>Brasil</em></span>
                                                </div>
                                            </div>

                                            {paymentPlanText && (
                                                <div className="pg-modal-card">
                                                    <p className="pg-modal-kicker">{isEn ? 'Payment options' : 'Opções de pagamento'}</p>
                                                    <RichText value={paymentPlanText} className="pg-modal-rich" />
                                                </div>
                                            )}

                                            {cancellationPolicyText && (
                                                <details className="pg-modal-details">
                                                    <summary>
                                                        <span>{isEn ? 'Cancellation policy' : 'Política de cancelamento'}</span>
                                                        <span className="pg-modal-details-icon" aria-hidden><Plus size={16} /></span>
                                                    </summary>
                                                    <div className="pg-modal-details-body">
                                                        <RichText value={cancellationPolicyText} className="pg-modal-rich" />
                                                    </div>
                                                </details>
                                            )}
                                        </section>
                                    )}
                                </>
                            ) : countryBasedFlightPolicy ? (
                                <>
                                    <section className="pg-modal-block">
                                        <div className="pg-modal-card">
                                            <h3 className="pg-display pg-modal-block-title">
                                                {isEn ? 'The rule depends on your country of residence' : 'A regra depende do seu país de residência'}
                                            </h3>
                                            <p className="pg-modal-note">
                                                {isEn
                                                    ? 'The registration form applies the correct rule automatically. There is no optional flight choice for this pilgrimage.'
                                                    : 'O formulário de inscrição aplica automaticamente a regra correta. Nesta peregrinação não existe uma escolha opcional de voo.'}
                                            </p>
                                        </div>
                                    </section>

                                    <section className="pg-modal-block">
                                        <div className="pg-modal-cols">
                                            <div className="pg-modal-card">
                                                <p className="pg-modal-kicker">{isEn ? 'Residents of Portugal or Brazil' : 'Residentes em Portugal ou no Brasil'}</p>
                                                <p className="pg-modal-strong">
                                                    {isEn
                                                        ? 'The agency air package is mandatory. Do not purchase these flights independently.'
                                                        : 'O pacote aéreo da agência é obrigatório. Não compre estes voos por conta própria.'}
                                                </p>
                                                <ul className="pg-modal-list">
                                                    {[
                                                        isEn ? 'Country of residence → Rome' : 'País de residência → Roma',
                                                        isEn ? 'Rome → Split' : 'Roma → Split',
                                                        isEn ? 'Split → home destination' : 'Split → destino de regresso',
                                                    ].map((item) => (
                                                        <li key={item} className="is-yes">
                                                            <span className="pg-modal-list-icon" aria-hidden><Check size={13} strokeWidth={2.5} /></span>
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <dl className="pg-modal-estimates">
                                                    <div>
                                                        <dt>{isEn ? 'Brazil estimate' : 'Estimativa Brasil'}</dt>
                                                        <dd className="pg-display">{formatFlightEstimate(countryBasedFlightPolicy.estimates_eur.BR, isEn ? 'en' : 'pt')}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>{isEn ? 'Portugal estimate' : 'Estimativa Portugal'}</dt>
                                                        <dd className="pg-display">{formatFlightEstimate(countryBasedFlightPolicy.estimates_eur.PT, isEn ? 'en' : 'pt')}</dd>
                                                    </div>
                                                </dl>
                                                <p className="pg-modal-note">
                                                    {isEn
                                                        ? 'Paid directly to the agency. Never added to the land-package registration total.'
                                                        : 'Pago diretamente à agência. Nunca é somado ao total terrestre da inscrição.'}
                                                </p>
                                            </div>

                                            <div className="pg-modal-card">
                                                <p className="pg-modal-kicker">{isEn ? 'Residents of every other country' : 'Residentes em todos os outros países'}</p>
                                                <p className="pg-modal-strong">
                                                    {isEn
                                                        ? 'You must purchase your own flights and comply with all three mandatory windows.'
                                                        : 'Tem de comprar as suas próprias passagens e cumprir as três janelas obrigatórias.'}
                                                </p>
                                                <ol className="pg-modal-timeline">
                                                    <li>
                                                        <strong>{isEn ? '5 April 2027' : '5 de abril de 2027'}</strong>
                                                        {isEn
                                                            ? `Be at ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.airport} by ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.by} (Rome local time).`
                                                            : `Estar no ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.airport} até às ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.by} (hora local de Roma).`}
                                                    </li>
                                                    <li>
                                                        <strong>{isEn ? '14 April 2027' : '14 de abril de 2027'}</strong>
                                                        {isEn ? 'Book Rome → Split for the afternoon.' : 'Reservar Roma → Split para a parte da tarde.'}
                                                    </li>
                                                    <li>
                                                        <strong>{isEn ? '17 April 2027' : '17 de abril de 2027'}</strong>
                                                        {isEn ? 'Book Split → home destination for the afternoon.' : 'Reservar Split → destino de regresso para a parte da tarde.'}
                                                    </li>
                                                </ol>
                                            </div>
                                        </div>
                                    </section>
                                </>
                            ) : (
                                <>
                                    <section className="pg-modal-block">
                                        <div className="pg-modal-cols">
                                            <div className="pg-modal-card">
                                                <p className="pg-modal-kicker">{isEn ? 'Flexibility' : 'Flexibilidade'}</p>
                                                <h3 className="pg-display pg-modal-block-title">{isEn ? 'Own flight' : 'Voo próprio'}</h3>
                                                <RichText
                                                    value={flightInfoText || (isEn ? 'You can arrange your own flight and meet the group at the point indicated by the organisation.' : 'Pode tratar do seu voo diretamente e encontrar-se com o grupo no ponto indicado pela organização.')}
                                                    className="pg-modal-rich"
                                                />
                                            </div>

                                            <div className="pg-modal-card">
                                                <p className="pg-modal-kicker">{isEn ? 'Organised by the agency' : 'Organizado pela agência'}</p>
                                                <h3 className="pg-display pg-modal-block-title">{isEn ? 'Group flight' : 'Voo de grupo'}</h3>
                                                {flightPriceFrom ? (
                                                    <>
                                                        <p className="pg-modal-note">
                                                            {isEn ? 'If you prefer, you can travel on the flight organised by the agency. This price is separate from the land package.' : 'Se preferir, pode seguir no voo organizado pela agência. Este valor é separado do terrestre.'}
                                                        </p>
                                                        {groupFlightDetails && <RichText value={groupFlightDetails} className="pg-modal-rich" />}
                                                        <div className="pg-modal-ref">
                                                            <p className="pg-modal-kicker">{isEn ? 'Reference price' : 'Valor de referência'}</p>
                                                            <PilgrimagePrice
                                                                amountInEur={flightPriceFrom}
                                                                layout="stacked"
                                                                primaryClassName="pg-display text-[2rem] text-[var(--pg-ink)]"
                                                                secondaryClassName="text-sm font-medium text-[var(--pg-ink-muted)]" fixedLabelClassName="text-[11px] font-medium normal-case tracking-normal text-[var(--pg-ink-faint)]" variableLabelClassName="text-[11px] font-medium normal-case tracking-normal text-[var(--pg-ink-faint)]"
                                                            />
                                                            <p className="pg-modal-note">
                                                                {isEn ? 'This payment is handled directly with the partner agency.' : 'Este pagamento é tratado diretamente com a agência parceira.'}
                                                            </p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="pg-modal-note">
                                                        {isEn ? 'There is currently no group flight option published for this pilgrimage.' : 'Nesta peregrinação não há neste momento uma opção de voo de grupo publicada.'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    {(meetingPointText || meetingEndText) && (
                                        <section className="pg-modal-block">
                                            <BlockTitle>{isEn ? 'Meeting point & return' : 'Encontro e regresso'}</BlockTitle>
                                            <div className="pg-modal-cols">
                                                {meetingPointText && (
                                                    <div className="pg-modal-card">
                                                        <p className="pg-modal-kicker">{isEn ? 'Meeting point' : 'Ponto de encontro'}</p>
                                                        <RichText value={meetingPointText} className="pg-modal-rich" />
                                                    </div>
                                                )}
                                                {meetingEndText && (
                                                    <div className="pg-modal-card">
                                                        <p className="pg-modal-kicker">{isEn ? 'End of trip' : 'Fim da viagem'}</p>
                                                        <RichText value={meetingEndText} className="pg-modal-rich" />
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Rodapé fixo */}
                        <div className="pg-modal-foot">
                            <p className="pg-modal-foot-hint">{footerHint}</p>
                            <div className="pg-modal-foot-actions">
                                <button type="button" onClick={onClose} className="pg-btn pg-btn-ghost">
                                    {isEn ? 'Close' : 'Fechar'}
                                </button>
                                <Link href={registrationLink} onClick={onClose} className="pg-btn pg-btn-primary">
                                    <span>{isEn ? 'I want to register' : 'Quero inscrever-me'}</span>
                                    <span className="pg-btn-arrow" aria-hidden><ArrowRight size={17} /><ArrowRight size={17} /></span>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
