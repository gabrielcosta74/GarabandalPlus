"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { X } from 'lucide-react';
import { EASE, Reveal } from './motion';

/* ------------------------------------------------------------------ */
/* Testemunhos: faixa horizontal contínua                              */
/* ------------------------------------------------------------------ */

export type Testimonial = { id: string; author_name: string; role: string | null; role_en: string | null; text: string; text_en: string | null };

/** "Danielle - Florianópolis ( Brasil)" → { name: "Danielle", place: "Florianópolis · Brasil" } */
function parseAuthor(raw: string) {
    const country = raw.match(/\(\s*([^)]+?)\s*\)/)?.[1] ?? '';
    const withoutCountry = raw.replace(/\(.*?\)/g, '').trim();
    const [name, ...rest] = withoutCountry.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    const place = [rest.join(' '), country].filter(Boolean).join(' · ');
    return { name: name || raw.trim(), place };
}

export function TestimonialsMarquee({ testimonials, isEn, title }: { testimonials: Testimonial[]; isEn: boolean; title: string }) {
    const reduce = useReducedMotion();
    if (testimonials.length === 0) return null;
    const animate = testimonials.length > 2 && !reduce;
    const list = animate ? [...testimonials, ...testimonials] : testimonials;

    return (
        <section className="relative overflow-hidden py-24 md:py-32">
            <div className="mx-auto mb-12 flex max-w-6xl items-end justify-between gap-6 px-5 md:mb-16 md:px-8 lg:px-12">
                <Reveal>
                    <span aria-hidden className="block select-none text-[5.5rem] font-semibold leading-[0.6] text-[#0b0b0c]/10 md:text-[7rem]">“</span>
                    <h2 className="pe-title mt-2 text-4xl leading-none md:text-6xl">{title}</h2>
                </Reveal>
            </div>

            <motion.div
                className="pe-marquee-wrap relative"
                initial={reduce ? false : { opacity: 0, x: 120 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 1.2, ease: EASE }}
            >
                <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[var(--pe-bg)] to-transparent md:w-40" />
                <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[var(--pe-bg)] to-transparent md:w-40" />
                <ul
                    className={`flex gap-6 px-5 ${animate ? 'pe-marquee' : 'overflow-x-auto'}`}
                    style={{ ['--pe-marquee-duration' as string]: `${testimonials.length * 5}s` }}
                >
                    {list.map((t, i) => {
                        const { name, place } = parseAuthor(t.author_name);
                        const dark = i % 3 === 1;
                        const text = (isEn ? t.text_en || t.text : t.text).trim();
                        return (
                            <li
                                key={`${t.id}-${i}`}
                                aria-hidden={i >= testimonials.length ? true : undefined}
                                className={`group flex w-[280px] shrink-0 flex-col justify-between rounded-[24px] p-7 transition-transform duration-500 ease-out hover:-translate-y-1.5 sm:w-[420px] md:rounded-[28px] md:p-10 ${dark ? 'bg-[#0b0b0c] text-white' : 'border border-black/[0.06] bg-white'}`}
                            >
                                <div>
                                    <span aria-hidden className={`block text-5xl font-semibold leading-[0.5] ${dark ? 'text-white/25' : 'text-[#0b0b0c]/15'}`}>“</span>
                                    <p className={`mt-5 text-[17px] font-medium leading-[1.5] tracking-[-0.01em] md:mt-6 md:text-[1.4rem] md:leading-[1.45] ${dark ? 'text-white' : 'text-[#141414]'}`}>
                                        {text}
                                    </p>
                                </div>
                                <div className={`mt-10 flex items-center gap-4 border-t pt-6 ${dark ? 'border-white/15' : 'border-[var(--pe-line)]'}`}>
                                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${dark ? 'bg-white text-[#0b0b0c]' : 'bg-[#0b0b0c] text-white'}`}>
                                        {name.charAt(0)}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate font-semibold">{name}</span>
                                        {place && <span className={`block truncate text-sm ${dark ? 'text-white/60' : 'text-[var(--pe-muted)]'}`}>{place}</span>}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </motion.div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Bloco de SEO + 3 pontos                                             */
/* ------------------------------------------------------------------ */

function WhyUsCard({ point, index, image, progress, parallax }: { point: { title: string; text: string }; index: number; image?: string; progress: MotionValue<number>; parallax: boolean }) {
    const reduce = useReducedMotion();
    // Cada coluna desliza a uma velocidade ligeiramente diferente (só no desktop).
    const y = useTransform(progress, [0, 1], reduce || !parallax ? [0, 0] : [40 + index * 40, -40 - index * 40]);
    return (
        <motion.li style={{ y }} className={index === 1 ? 'md:mt-16' : ''}>
            <div className="group">
                <motion.div
                    className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-black/5 md:aspect-[4/5] md:rounded-[24px]"
                    initial={reduce ? false : { clipPath: 'inset(100% 0% 0% 0%)' }}
                    whileInView={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                    viewport={{ once: true, margin: '0px 0px -12% 0px' }}
                    transition={{ duration: 1.2, ease: EASE, delay: index * 0.15 }}
                >
                    {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={image}
                            alt=""
                            loading="lazy"
                            className="h-full w-full scale-[1.08] object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.14]"
                        />
                    )}
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                    <span className="absolute left-6 top-6 text-sm font-semibold tabular-nums text-white">{String(index + 1).padStart(2, '0')}</span>
                </motion.div>
                <Reveal delay={0.2 + index * 0.12} y={16}>
                    <h3 className="mt-6 text-2xl font-semibold tracking-tight">{point.title}</h3>
                    <p className="mt-2 max-w-sm leading-7 text-[var(--pe-muted)]">{point.text}</p>
                </Reveal>
            </div>
        </motion.li>
    );
}

export function WhyUs({ isEn, points, images }: { isEn: boolean; points: { title: string; text: string }[]; images: string[] }) {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const [parallax, setParallax] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 768px)');
        const sync = () => setParallax(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    return (
        <section ref={ref} className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32 lg:px-12">
            {/* Cabeçalho editorial: título à esquerda, texto à direita */}
            <div className="grid gap-8 md:grid-cols-[1.25fr_1fr] md:items-end md:gap-16">
                <Reveal>
                    <p className="pe-eyebrow text-[var(--pe-muted)]">{isEn ? 'Catholic Marian pilgrimages' : 'Peregrinações marianas católicas'}</p>
                    <h2 className="pe-title mt-5 text-4xl leading-[1.02] md:text-[3.6rem]">
                        {isEn
                            ? 'Pilgrimages to Garabandal, Fatima and Iberian Catholic shrines'
                            : 'Peregrinações a Garabandal, Fátima e santuários católicos ibéricos'}
                    </h2>
                </Reveal>
                <Reveal delay={0.12}>
                    <p className="text-lg leading-8 text-[var(--pe-muted)]">
                        {isEn
                            ? 'The Apostolate of Garabandal organises Catholic Marian pilgrimages for pilgrims from Portugal, Brazil and the Portuguese-speaking world, combining prayer, Mass, spiritual guidance, community and clear travel logistics.'
                            : 'O Apostolado de Garabandal organiza peregrinações marianas católicas para peregrinos de Portugal, do Brasil e do mundo lusófono, unindo oração, Santa Missa, acompanhamento espiritual, vida em comunidade e logística clara de viagem.'}
                    </p>
                </Reveal>
            </div>

            <ul className="mt-16 grid gap-12 md:mt-24 md:grid-cols-3 md:gap-8">
                {points.map((point, i) => (
                    <WhyUsCard key={point.title} point={point} index={i} image={images[i % Math.max(images.length, 1)]} progress={scrollYProgress} parallax={parallax} />
                ))}
            </ul>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Memórias: colagem viva — cada moldura troca de foto em cascata       */
/* ------------------------------------------------------------------ */

// Mosaico de 5 molduras, todas horizontais.
// Desktop (6 colunas × 3 linhas): grande à esquerda (3×2), duas faixas à direita,
// duas em baixo. Mobile (2 colunas): a primeira ocupa a largura e 2 linhas, as
// outras 4 ficam num mosaico 2×2 — todas horizontais.
const COLLAGE_TILES = [
    'col-span-2 row-span-2 md:col-span-3 md:row-span-2',
    'md:col-span-3',
    'md:col-span-3',
    'md:col-span-3',
    'md:col-span-3',
];
// Ritmo calmo: cada moldura troca de 7 em 7 s, com ~1 s entre molduras.
const STEP_MS = 7000;
const TILE_STAGGER_MS = 900;
const FADE_S = 2.2;

function CollageTile({ src, index, className, onOpen, label }: { src: string; index: number; className: string; onOpen: (src: string) => void; label: string }) {
    const reduce = useReducedMotion();
    return (
        <motion.li
            className={`relative overflow-hidden bg-white/5 ${className}`}
            initial={reduce ? false : { opacity: 0, scale: 1.08 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            transition={{ duration: 1, ease: EASE, delay: index * 0.1 }}
        >
            <button type="button" onClick={() => onOpen(src)} aria-label={label} className="group absolute inset-0 cursor-zoom-in">
                <AnimatePresence initial={false}>
                    <motion.span
                        key={src}
                        className="absolute inset-0 block"
                        // Crossfade lento: a nova aparece por cima da antiga; a antiga fica
                        // totalmente visível por baixo e só é retirada depois (nunca há buraco preto).
                        initial={{ opacity: 0, scale: reduce ? 1 : 1.06 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 1, transition: { duration: FADE_S + 0.4 } }}
                        transition={{ opacity: { duration: FADE_S, ease: [0.4, 0, 0.2, 1] }, scale: { duration: STEP_MS / 1000 + FADE_S, ease: 'linear' } }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]" />
                    </motion.span>
                </AnimatePresence>
                <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-500 group-hover:bg-black/15" />
            </button>
        </motion.li>
    );
}

export function GalleryCollage({ images, title, subtitle, isEn }: { images: string[]; title: string; subtitle: string; isEn: boolean }) {
    const reduce = useReducedMotion();
    const [selected, setSelected] = useState<string | null>(null);
    const tiles = Math.min(COLLAGE_TILES.length, images.length);
    // Cada moldura tem o seu próprio passo. Trocam da última para a primeira:
    // a moldura i passa para a foto que a i+1 acabou de largar, por isso nunca
    // há a mesma foto em duas molduras ao mesmo tempo (com mais fotos que molduras).
    const [steps, setSteps] = useState<number[]>(() => Array.from({ length: COLLAGE_TILES.length }, () => 0));

    useEffect(() => {
        if (reduce || images.length <= tiles) return;
        const timeouts: ReturnType<typeof setTimeout>[] = [];
        const interval = setInterval(() => {
            if (document.hidden) return;
            for (let i = tiles - 1; i >= 0; i--) {
                const delay = (tiles - 1 - i) * TILE_STAGGER_MS;
                timeouts.push(setTimeout(() => setSteps((prev) => prev.map((v, k) => (k === i ? v + 1 : v))), delay));
            }
        }, STEP_MS);
        return () => {
            clearInterval(interval);
            timeouts.forEach(clearTimeout);
        };
    }, [images.length, reduce, tiles]);

    useEffect(() => {
        if (!selected) return;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKey);
        };
    }, [selected]);

    if (tiles === 0) return null;

    return (
        <section className="relative overflow-hidden bg-[#0b0b0c] md:h-[100svh] md:min-h-[620px]">
            {/* Título: no mobile fica em cima da colagem; no desktop por cima das fotos, em baixo */}
            <div className="relative z-10 pb-8 pt-20 text-white md:pointer-events-none md:absolute md:inset-x-0 md:bottom-0 md:pb-14 md:pt-0">
                <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5 md:gap-6 md:px-8 lg:px-12">
                    <Reveal>
                        <p className="pe-eyebrow text-white/70">2008 — 2025</p>
                        <h2 className="pe-title mt-3 text-5xl leading-none md:mt-4 md:text-8xl">{title}</h2>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <p className="max-w-xs text-base leading-7 text-white/70 md:text-right md:text-lg md:text-white/75">{subtitle}</p>
                    </Reveal>
                </div>
            </div>

            <ul className="grid auto-rows-[136px] grid-cols-2 gap-1.5 sm:auto-rows-[200px] md:h-full md:auto-rows-auto md:grid-cols-6 md:grid-rows-3">
                {Array.from({ length: tiles }, (_, i) => (
                    <CollageTile
                        key={i}
                        index={i}
                        className={COLLAGE_TILES[i]}
                        src={images[(i + steps[i]) % images.length]}
                        onOpen={setSelected}
                        label={isEn ? 'Open photo' : 'Abrir fotografia'}
                    />
                ))}
            </ul>

            {/* Escurecimento para o título (só desktop, onde o título fica por cima das fotos) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black/80 via-black/10 to-black/30 md:block" />

            <AnimatePresence>
                {selected && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelected(null)}
                        className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 md:p-10"
                    >
                        <button type="button" onClick={() => setSelected(null)} className="absolute right-5 top-5 p-2 text-white/60 transition-colors hover:text-white" aria-label={isEn ? 'Close' : 'Fechar'}>
                            <X size={30} />
                        </button>
                        <motion.img
                            src={selected}
                            alt=""
                            initial={{ scale: 0.94, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.94, opacity: 0 }}
                            transition={{ duration: 0.45, ease: EASE }}
                            onClick={(e) => e.stopPropagation()}
                            className="max-h-[85vh] max-w-full rounded-lg object-contain"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Mais do que uma Viagem, uma Missão                                  */
/* ------------------------------------------------------------------ */

function MissionItem({ item, defaultOpen }: { item: { title: string; text: string }; defaultOpen: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="py-5 first:pt-0 last:pb-0">
            {/* Mobile: abre/fecha ao toque. Desktop: sempre aberto, como antes. */}
            <dt>
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 text-left font-semibold md:pointer-events-none md:cursor-default"
                >
                    {item.title}
                    <motion.span
                        aria-hidden
                        animate={{ rotate: open ? 45 : 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-lg leading-none md:hidden"
                    >
                        +
                    </motion.span>
                </button>
            </dt>
            <dd className={`mt-2 text-sm leading-7 text-[var(--pe-muted)] ${open ? 'block' : 'hidden'} md:block`}>{item.text}</dd>
        </div>
    );
}

export function Mission({ title, desc, items }: { title: string; desc: string; items: { title: string; text: string }[] }) {
    return (
        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24 lg:px-12">
            <Reveal>
                <div className="grid gap-8 rounded-[24px] border border-black/[0.06] bg-white p-6 md:grid-cols-[1.1fr_1fr] md:gap-14 md:rounded-[28px] md:p-12">
                    <div>
                        <h2 className="pe-title text-3xl leading-tight md:text-4xl">{title}</h2>
                        <p className="mt-4 text-[15px] leading-7 text-[var(--pe-muted)] md:mt-5 md:text-base md:leading-8">{desc}</p>
                    </div>
                    <dl className="divide-y divide-[var(--pe-line)] border-t border-[var(--pe-line)] pt-5 md:border-t-0 md:pt-0">
                        {items.map((item) => (
                            <MissionItem key={item.title} item={item} defaultOpen={false} />
                        ))}
                    </dl>
                </div>
            </Reveal>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Não encontrou a data ideal?                                         */
/* ------------------------------------------------------------------ */

export function WaitlistPanel({ title, desc, form }: { title: string; desc: string; form: React.ReactNode }) {
    return (
        <section className="mx-auto max-w-6xl px-5 pb-24 pt-8 md:px-8 md:pb-32 lg:px-12">
            <Reveal>
                <div className="rounded-[28px] bg-[#0b0b0c] px-6 py-14 text-center text-white md:px-12 md:py-20">
                    <h3 className="pe-title text-3xl md:text-4xl">{title}</h3>
                    <p className="mx-auto mb-9 mt-4 max-w-lg text-white/65">{desc}</p>
                    {form}
                </div>
            </Reveal>
        </section>
    );
}
