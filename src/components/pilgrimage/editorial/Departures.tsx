"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { EASE, Reveal } from './motion';
import { dateRangeOf, remainingSpotsOf, shortTitleOf, titleOf, type EditionPilgrimage } from './utils';
import { getPilgrimageCover } from '../../../lib/pilgrimage-covers';
import { getCivilDateTimestamp, getScarcitySoldPercent, todayCivilTimestamp } from '../../../lib/utils';
import { format } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';

/* ------------------------------------------------------------------ */
/* Destaque em ecrã inteiro: a próxima partida com vagas                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Bloco de urgência — só com dados reais:                              */
/*  · ocupação real (ou pricing_config.scarcity_fill_pct), só decide o  */
/*    selo (>=80% Últimas vagas); nunca se mostra quantidade           */
/*  · prazo de inscrição + dias que faltam                              */
/*  · quantas das últimas peregrinações esgotaram                       */
/* A mensagem sobe de nível sozinha: ≥50% "mais de metade", ≥80%        */
/* "vagas quase esgotadas".                                             */
/* ------------------------------------------------------------------ */

const ALERT = '#ff5a36';
const ALERT_SOFT = '#ffb020';

/** Contagem decrescente até ao fecho das inscrições. No servidor mostra só os
 *  dias (evita diferenças de hidratação); depois de montar passa a ao segundo. */
function Countdown({ target, isEn }: { target: number; isEn: boolean }) {
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    const diff = Math.max(0, target - (now ?? todayCivilTimestamp()));
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    const units = [
        { v: days, l: isEn ? 'days' : 'dias' },
        { v: hours, l: 'h' },
        { v: minutes, l: 'min' },
        { v: seconds, l: 's' },
    ];
    return (
        <span className="flex items-baseline gap-3 tabular-nums" suppressHydrationWarning>
            {units.map((u, i) => (
                <span key={u.l} className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold leading-none tracking-tight md:text-[1.7rem]" suppressHydrationWarning>
                        {now === null && i > 0 ? '--' : String(u.v).padStart(i === 0 ? 1 : 2, '0')}
                    </span>
                    <span className="text-xs text-white/55">{u.l}</span>
                </span>
            ))}
        </span>
    );
}

function Urgency({
    pilgrimage,
    isEn,
    soldOutCount,
}: {
    pilgrimage: EditionPilgrimage & { registration_deadline?: string | null };
    isEn: boolean;
    soldOutCount: number;
}) {
    const reduce = useReducedMotion();
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });

    const total = Number(pilgrimage.total_vacancies || 0);
    const remaining = remainingSpotsOf(pilgrimage);
    const configured = getScarcitySoldPercent(pilgrimage);
    const realPct = total > 0 ? Math.floor((((total - remaining) / total) * 100) / 5) * 5 : 0;
    const fillPct = Math.min(95, configured > 0 ? configured : realPct);

    // Sem quantidades à vista: só a ideia de que esgota depressa.
    const level = fillPct >= 80 ? 'almost' : 'fast';
    const message = isEn ? 'Spots are selling out fast' : 'As vagas estão a esgotar rapidamente';
    const tag = level === 'almost' ? (isEn ? 'Last spots' : 'Últimas vagas') : (isEn ? 'High demand' : 'Muita procura');

    const deadlineTs = getCivilDateTimestamp(pilgrimage.registration_deadline || '');
    const hasDeadline = Number.isFinite(deadlineTs) && deadlineTs > todayCivilTimestamp();
    const deadlineLabel = hasDeadline
        ? format(new Date(deadlineTs), isEn ? 'MMM d, yyyy' : 'd MMM yyyy', { locale: isEn ? enUS : pt })
        : null;

    return (
        <motion.div
            ref={ref}
            className="relative mt-7 overflow-hidden rounded-[22px] border backdrop-blur-md lg:mt-10"
            style={{ borderColor: 'rgba(255,90,54,0.35)', background: 'linear-gradient(135deg, rgba(255,90,54,0.14), rgba(255,255,255,0.04) 55%)' }}
            animate={reduce ? undefined : { boxShadow: ['0 0 0 0 rgba(255,90,54,0)', '0 0 48px -10px rgba(255,90,54,0.55)', '0 0 0 0 rgba(255,90,54,0)'] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
            <div className="p-6 md:p-7">
                <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
                    <div>
                        <p className="flex items-center gap-3 text-lg font-semibold leading-snug md:text-xl">
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: ALERT }} />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: ALERT }} />
                            </span>
                            {message}
                        </p>
                        <motion.p
                            className="mt-1.5 pl-[22px] text-[15px] text-white/70"
                            initial={reduce ? false : { opacity: 0, x: -8 }}
                            animate={inView ? { opacity: 1, x: 0 } : undefined}
                            transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
                        >
                            {isEn ? 'Secure your place now.' : 'Garanta já o seu lugar.'}
                        </motion.p>
                    </div>
                    <motion.span
                        className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b0b0c]"
                        style={{ background: ALERT_SOFT }}
                        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                        animate={inView ? (reduce ? { scale: 1, opacity: 1 } : { scale: [0.6, 1.08, 1], opacity: 1, rotate: [0, -4, 4, -2, 0] }) : undefined}
                        transition={{ duration: 0.9, delay: 0.9, rotate: { duration: 0.6, delay: 1.2, repeat: Infinity, repeatDelay: 4 } }}
                    >
                        {tag}
                    </motion.span>
                </div>
            </div>

            {(hasDeadline || soldOutCount > 0) && (
                <dl className={`grid ${hasDeadline && soldOutCount > 0 ? 'sm:grid-cols-[1.25fr_1fr]' : ''} border-t border-white/12`} style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                    {hasDeadline && (
                        <motion.div
                            className="p-6 md:p-7"
                            initial={reduce ? false : { opacity: 0, y: 10 }}
                            animate={inView ? { opacity: 1, y: 0 } : undefined}
                            transition={{ duration: 0.7, ease: EASE, delay: 0.6 }}
                        >
                            <dt className="text-xs uppercase tracking-[0.16em]" style={{ color: ALERT_SOFT }}>
                                {isEn ? 'Registration closes in' : 'Inscrições fecham em'}
                            </dt>
                            <dd className="mt-2.5"><Countdown target={deadlineTs} isEn={isEn} /></dd>
                            <dd className="mt-2 text-sm text-white/55">{deadlineLabel}</dd>
                        </motion.div>
                    )}
                    {soldOutCount > 0 && (
                        <motion.div
                            className={`p-6 md:p-7 ${hasDeadline ? 'border-t border-white/12 sm:border-l sm:border-t-0' : ''}`}
                            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
                            initial={reduce ? false : { opacity: 0, y: 10 }}
                            animate={inView ? { opacity: 1, y: 0 } : undefined}
                            transition={{ duration: 0.7, ease: EASE, delay: 0.72 }}
                        >
                            <dt className="text-xs uppercase tracking-[0.16em]" style={{ color: ALERT_SOFT }}>{isEn ? 'Recent departures' : 'Últimas partidas'}</dt>
                            <dd className="mt-2.5 text-lg font-semibold leading-snug">
                                {soldOutCount === 1
                                    ? (isEn ? 'The last pilgrimage sold out' : 'A última peregrinação esgotou')
                                    : (isEn ? `The last ${soldOutCount} pilgrimages sold out` : `As ${soldOutCount} últimas peregrinações esgotaram`)}
                            </dd>
                        </motion.div>
                    )}
                </dl>
            )}
        </motion.div>
    );
}

export function FeaturedDeparture({
    pilgrimage,
    isEn,
    listHref,
    eyebrow,
    soldOutCount,
}: {
    pilgrimage: EditionPilgrimage & { registration_deadline?: string | null };
    isEn: boolean;
    listHref: string;
    eyebrow: string;
    soldOutCount: number;
}) {
    const ref = useRef<HTMLElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const bgY = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['-8%', '8%']);
    const posterY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [70, -70]);

    const href = `${listHref}/${pilgrimage.slug}`;
    const cover = getPilgrimageCover(pilgrimage, isEn ? 'en' : 'pt');
    const range = dateRangeOf(pilgrimage, isEn);

    return (
        <section
            ref={ref}
            id="partidas"
            aria-labelledby="featured-title"
            className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[#0b0b0c] text-white"
        >
            {/* Fundo: a própria capa, ampliada e desfocada, com movimento lento */}
            {cover.src && (
                <motion.div aria-hidden className="absolute -inset-[12%] -z-10" style={{ y: bgY }}>
                    <Image src={cover.src} alt="" fill sizes="100vw" className="scale-110 object-cover blur-2xl saturate-[1.15]" />
                </motion.div>
            )}
            <div aria-hidden className="absolute inset-0 -z-10 bg-black/55" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/30 via-black/10 to-black/60" />

            <div className="mx-auto grid w-full max-w-6xl items-center gap-9 px-5 pb-24 pt-20 md:px-8 md:py-20 lg:grid-cols-2 lg:gap-16 lg:px-12">
                {/* Capa nítida, inteira */}
                <motion.div style={{ y: posterY }} className="mx-auto w-full max-w-[420px] lg:max-w-[560px]">
                    <Link href={href} className="group block" aria-label={titleOf(pilgrimage, isEn)}>
                        <motion.div
                            initial={reduce ? false : { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.08 }}
                            whileInView={{ clipPath: 'inset(0% 0% 0% 0%)', scale: 1 }}
                            viewport={{ once: true, margin: '0px 0px -15% 0px' }}
                            transition={{ duration: 1.3, ease: EASE }}
                        >
                            {cover.src && (
                                <Image
                                    src={cover.src}
                                    alt={cover.alt}
                                    width={1198}
                                    height={1313}
                                    sizes="(max-width: 1024px) 420px, 560px"
                                    className="h-auto w-full rounded-[10px] shadow-[0_50px_100px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-transform duration-700 ease-out group-hover:-translate-y-1.5"
                                />
                            )}
                        </motion.div>
                    </Link>
                </motion.div>

                {/* Informação */}
                <div>
                    <Reveal y={16} className="hidden lg:block">
                        <p className="pe-eyebrow flex flex-wrap items-center gap-3 text-white/60">
                            {eyebrow}
                            <span aria-hidden className="h-px w-8 bg-white/30" />
                            <span className="flex items-center gap-2 text-white">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-50" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                                </span>
                                {isEn ? 'Registration open' : 'Inscrições abertas'}
                            </span>
                        </p>
                    </Reveal>

                    <Reveal y={20} delay={0.08}>
                        <h2 id="featured-title" className="pe-title sr-only mt-6 text-5xl leading-[0.98] md:text-6xl lg:not-sr-only lg:block">{shortTitleOf(pilgrimage, isEn)}</h2>
                        <p className="mt-4 hidden text-white/60 lg:block">{titleOf(pilgrimage, isEn)}</p>
                    </Reveal>

                    <Reveal y={16} delay={0.16}>
                        <p className="flex flex-wrap items-baseline justify-center gap-x-3 text-center lg:mt-8 lg:justify-start lg:text-left">
                            <span className="text-2xl font-semibold tabular-nums md:text-3xl">{range.label}</span>
                            <span className="text-white/60">· {range.duration} {isEn ? 'days' : 'dias'}</span>
                        </p>
                    </Reveal>

                    <Urgency pilgrimage={pilgrimage} isEn={isEn} soldOutCount={soldOutCount} />

                    <Reveal y={16} delay={0.3} className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                        <Link
                            href={href}
                            className="group relative inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-brand px-8 text-base font-semibold text-white transition-colors hover:bg-brand-700"
                        >
                            {!reduce && (
                                <motion.span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-brand"
                                    animate={{ scale: [1, 1.18], opacity: [0.7, 0] }}
                                    transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.8, ease: 'easeOut' }}
                                />
                            )}
                            {isEn ? 'See pilgrimage' : 'Ver peregrinação'}
                            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </Link>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Outras partidas (esgotadas): faixa horizontal                        */
/* ------------------------------------------------------------------ */

export function OtherDepartures({
    otherOpen,
    unavailable,
    isEn,
    listHref,
    soldOutLabel,
    waitlistLabel,
    withAnchor,
}: {
    otherOpen: EditionPilgrimage[];
    unavailable: EditionPilgrimage[];
    isEn: boolean;
    listHref: string;
    soldOutLabel: string;
    waitlistLabel: string;
    withAnchor: boolean;
}) {
    const reduce = useReducedMotion();
    const trackRef = useRef<HTMLUListElement>(null);
    const [canScroll, setCanScroll] = useState(false);
    const items = [...otherOpen, ...unavailable];

    // As setas só aparecem quando há cartões fora do ecrã.
    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const sync = () => setCanScroll(track.scrollWidth > track.clientWidth + 4);
        sync();
        const observer = new ResizeObserver(sync);
        observer.observe(track);
        return () => observer.disconnect();
    }, [items.length]);

    if (items.length === 0) return null;

    const scrollByCard = (dir: 1 | -1) => {
        const track = trackRef.current;
        if (!track) return;
        const card = track.querySelector('li');
        const step = card ? card.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
        track.scrollBy({ left: dir * step, behavior: reduce ? 'auto' : 'smooth' });
    };

    const onlySoldOut = otherOpen.length === 0;
    const gutter = 'max(1.25rem, calc((100vw - 72rem) / 2 + 3rem))';

    return (
        <section id={withAnchor ? 'partidas' : undefined} className="scroll-mt-24 py-24 md:py-32">
            <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-5 md:px-8 lg:px-12">
                <Reveal>
                    <p className="pe-eyebrow text-[var(--pe-muted)]">{isEn ? 'Other departures' : 'Outras partidas'}</p>
                    <h2 className="pe-title mt-4 text-4xl leading-none md:text-6xl">
                        {onlySoldOut ? (isEn ? 'Sold out' : 'Esgotadas') : (isEn ? 'More departures' : 'Mais partidas')}
                    </h2>
                </Reveal>
                {canScroll && (
                    <div className="hidden gap-2 md:flex">
                        <button type="button" onClick={() => scrollByCard(-1)} aria-label={isEn ? 'Previous' : 'Anterior'} className="flex h-12 w-12 items-center justify-center rounded-full border border-black/15 transition-colors hover:border-[#0b0b0c] hover:bg-[#0b0b0c] hover:text-white">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <button type="button" onClick={() => scrollByCard(1)} aria-label={isEn ? 'Next' : 'Seguinte'} className="flex h-12 w-12 items-center justify-center rounded-full border border-black/15 transition-colors hover:border-[#0b0b0c] hover:bg-[#0b0b0c] hover:text-white">
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* A faixa começa alinhada ao conteúdo e sangra até à margem direita */}
            <ul
                ref={trackRef}
                className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ paddingLeft: gutter, paddingRight: '1.25rem', scrollPaddingLeft: gutter }}
            >
                {items.map((pilgrimage, i) => {
                    const isOpen = otherOpen.includes(pilgrimage);
                    const isWaitlist = pilgrimage.status === 'waitlist' && remainingSpotsOf(pilgrimage) > 0;
                    const label = isOpen ? (isEn ? 'Registration open' : 'Inscrições abertas') : isWaitlist ? waitlistLabel : soldOutLabel;
                    const cover = getPilgrimageCover(pilgrimage, isEn ? 'en' : 'pt');
                    const range = dateRangeOf(pilgrimage, isEn);
                    return (
                        <motion.li
                            key={pilgrimage.id}
                            className="w-[80vw] shrink-0 snap-start sm:w-[420px]"
                            initial={reduce ? false : { opacity: 0, x: 80 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                            transition={{ duration: 1, ease: EASE, delay: i * 0.12 }}
                        >
                            <Link href={`${listHref}/${pilgrimage.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-[24px] bg-[#e9e9e6]">
                                {cover.src && (
                                    <Image
                                        src={cover.src}
                                        alt={cover.alt}
                                        fill
                                        sizes="(max-width: 640px) 80vw, 420px"
                                        className={`object-cover object-top transition-[transform,filter] duration-[1.2s] ease-out group-hover:scale-[1.05] ${isOpen ? '' : 'blur-[2px] brightness-[0.55] saturate-[0.8] group-hover:blur-0 group-hover:brightness-[0.7]'}`}
                                    />
                                )}
                                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                                {isOpen ? (
                                    <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b0b0c] backdrop-blur">
                                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
                                        {label}
                                    </span>
                                ) : (
                                    /* Esgotada: cadeado ao centro + faixa "Esgotado" */
                                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 pb-16">
                                        <motion.span
                                            aria-hidden
                                            className="flex h-20 w-20 items-center justify-center rounded-full border border-white/35 bg-white/10 text-white backdrop-blur-md"
                                            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                                            whileInView={{ scale: 1, opacity: 1 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.7, ease: EASE, delay: 0.35 + i * 0.12 }}
                                        >
                                            <Lock className="h-8 w-8 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" strokeWidth={1.75} />
                                        </motion.span>
                                        <span className="rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-[#0b0b0c]">
                                            {label}
                                        </span>
                                    </span>
                                )}

                                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-white">
                                    <div className="transition-transform duration-500 ease-out group-hover:-translate-y-1">
                                        <p className="text-2xl font-semibold tracking-tight">{shortTitleOf(pilgrimage, isEn)}</p>
                                        <p className="mt-1 text-sm text-white/70">{range.label}</p>
                                    </div>
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/40 transition-all duration-500 group-hover:-rotate-45 group-hover:border-white group-hover:bg-white group-hover:text-[#0b0b0c]">
                                        <ArrowRight className="h-4 w-4" />
                                    </span>
                                </div>
                            </Link>
                        </motion.li>
                    );
                })}
            </ul>
        </section>
    );
}
