"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { EASE } from './motion';

type NextDeparture = { href: string; title: string; dateLabel: string } | null;

const SLIDE_MS = 6500;
const FADE_S = 1.6;

/** Linha do título que sobe de dentro de uma fenda. */
function Line({ children, delay }: { children: React.ReactNode; delay: number }) {
    const reduce = useReducedMotion();
    return (
        <span className="block overflow-hidden pb-[0.06em]">
            <motion.span
                className="block"
                initial={reduce ? false : { y: '105%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1.15, ease: EASE, delay }}
            >
                {children}
            </motion.span>
        </span>
    );
}

function FadeUp({ children, delay, className }: { children: React.ReactNode; delay: number; className?: string }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            className={className}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay }}
        >
            {children}
        </motion.div>
    );
}

export function PilgrimagesHero({ isEn, images, nextDeparture }: { isEn: boolean; images: string[]; nextDeparture: NextDeparture }) {
    const ref = useRef<HTMLElement>(null);
    const reduce = useReducedMotion();
    // Contador sempre a crescer: cada plano tem uma chave única no AnimatePresence.
    const [slide, setSlide] = useState(0);
    const current = images.length ? slide % images.length : 0;

    useEffect(() => {
        if (images.length < 2) return;
        const timer = setInterval(() => {
            if (!document.hidden) setSlide((s) => s + 1);
        }, SLIDE_MS);
        return () => clearInterval(timer);
    }, [images.length]);

    const goTo = (index: number) =>
        setSlide((s) => {
            const total = images.length || 1;
            const delta = (index - (s % total) + total) % total;
            return s + delta;
        });

    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
    const imageY = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['0%', '18%']);
    const contentY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -60]);
    const contentOpacity = useTransform(scrollYProgress, [0, 0.6], reduce ? [1, 1] : [1, 0]);

    const donationsHref = isEn ? '/en/donations' : '/donations';
    const alt = isEn ? 'Moments from our pilgrimages' : 'Momentos das nossas peregrinações';

    return (
        <section ref={ref} className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-[#0b0b0c] pb-20 pt-32 text-white md:h-[100svh] md:min-h-[680px] md:pb-0 md:pt-0">
            {/* Fotos a passar: crossfade contínuo com zoom lento (alterna o sentido) */}
            <motion.div className="absolute inset-0 -z-10" style={{ y: imageY }}>
                <AnimatePresence initial={false}>
                    <motion.div
                        key={slide}
                        className="absolute inset-0"
                        initial={{ opacity: 0, scale: reduce ? 1 : slide % 2 ? 1.04 : 1.14 }}
                        animate={{ opacity: 1, scale: reduce ? 1 : slide % 2 ? 1.14 : 1.04 }}
                        exit={{ opacity: 0 }}
                        transition={{
                            opacity: { duration: slide === 0 ? 1.2 : FADE_S, ease: 'easeInOut' },
                            scale: { duration: SLIDE_MS / 1000 + FADE_S, ease: 'linear' },
                        }}
                    >
                        {images[current] && (
                            <Image
                                src={images[current]}
                                alt={alt}
                                fill
                                priority={slide === 0}
                                quality={85}
                                sizes="100vw"
                                className="object-cover object-[center_35%]"
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </motion.div>
            {/* Escurecimento neutro para o texto se ler */}
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/25" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />

            <motion.div style={{ y: contentY, opacity: contentOpacity }} className="mx-auto w-full max-w-6xl px-5 pb-10 md:px-8 md:pb-14 lg:px-12">
                <h1 className="pe-title text-[2.55rem] leading-[1] sm:text-6xl md:text-7xl md:leading-[0.98] lg:text-[5.75rem]">
                    <Line delay={0.3}>{isEn ? 'Catholic Marian' : 'Peregrinações'}</Line>
                    <Line delay={0.42}>{isEn ? 'Pilgrimages' : 'Marianas Católicas'}</Line>
                </h1>

                <FadeUp delay={0.7}>
                    <p className="mt-5 max-w-xl text-[17px] leading-7 text-white/80 md:mt-7 md:text-lg md:leading-8">
                        {isEn
                            ? 'Spiritual journeys organised by the Apostolate of Garabandal to raise funds for building the House of the Apostolate.'
                            : 'Viagens espirituais organizadas pelo Apostolado de Garabandal para angariar fundos para a construção da Casa do Apostolado.'}
                    </p>
                </FadeUp>

                <FadeUp delay={0.85} className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center md:mt-9">
                    <a
                        href="#partidas"
                        className="group inline-flex min-h-[52px] items-center justify-center gap-3 rounded-full bg-brand px-7 text-base font-semibold text-white transition-colors hover:bg-brand-700 md:min-h-14"
                    >
                        {isEn ? 'Upcoming Departures' : 'Próximas Partidas'}
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </a>
                    <Link
                        href={donationsHref}
                        className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/30 px-7 text-base font-semibold text-white transition-colors hover:border-white hover:bg-white hover:text-[#0b0b0c] md:min-h-14"
                    >
                        {isEn ? 'Learn about the Project' : 'Conhecer o Projeto'}
                    </Link>
                </FadeUp>

                <FadeUp delay={1.05} className="mt-9 flex flex-col gap-4 border-t border-white/15 pt-5 md:mt-16 md:flex-row md:items-center md:justify-between md:gap-5">
                    {nextDeparture ? (
                        <Link href={nextDeparture.href} className="group flex items-center justify-between gap-4 text-sm md:flex-wrap md:justify-start md:gap-x-3 md:gap-y-1">
                            <span className="flex min-w-0 flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-x-3">
                                <span className="pe-eyebrow text-[10px] text-white/55 md:text-[0.72rem]">{isEn ? 'Next departure' : 'Próxima partida'}</span>
                                <span className="text-[15px] font-semibold text-white md:text-sm">
                                    {nextDeparture.title}
                                    <span className="font-normal text-white/65 md:ml-3"><span className="md:hidden"> · </span>{nextDeparture.dateLabel}</span>
                                </span>
                            </span>
                            {/* Mobile: seta redonda; desktop: "· Saber Mais →" */}
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 md:hidden">
                                <ArrowRight className="h-4 w-4" />
                            </span>
                            <span className="hidden items-center gap-1.5 font-semibold text-white md:inline-flex">
                                · {isEn ? 'Learn More' : 'Saber Mais'}
                                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                            </span>
                        </Link>
                    ) : <span />}

                    {/* Indicador das fotos: barra que enche ao ritmo de cada plano */}
                    {images.length > 1 && (
                        <div className="flex items-center gap-2">
                            {images.map((src, i) => (
                                <button
                                    key={`${src}-${i}`}
                                    type="button"
                                    onClick={() => goTo(i)}
                                    aria-label={`${isEn ? 'Show image' : 'Ver imagem'} ${i + 1}`}
                                    aria-current={i === current ? 'true' : undefined}
                                    className="flex h-6 w-8 items-center md:w-10"
                                >
                                    <span className="relative block h-[2px] w-full overflow-hidden rounded-full bg-white/25">
                                        {i === current && (
                                            <motion.span
                                                key={slide}
                                                className="absolute inset-y-0 left-0 bg-white"
                                                initial={{ width: reduce ? '100%' : '0%' }}
                                                animate={{ width: '100%' }}
                                                transition={{ duration: reduce ? 0 : SLIDE_MS / 1000, ease: 'linear' }}
                                            />
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </FadeUp>
            </motion.div>
        </section>
    );
}
