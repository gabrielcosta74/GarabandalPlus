"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Church, Flame, MapPin, Mic2, PlayCircle, Plus, ScrollText, Smartphone, Users } from "lucide-react";
import { useLocale } from "../../contexts/LocaleContext";
import { useCurrency } from "../providers/CurrencyProvider";
import { getMembershipAmountClient } from "../../lib/membership-pricing";
import { CONTAINER, H2_CLASS } from "../home/ui";

/**
 * /tornar-membro landing. Presentation only: the join flow lives in
 * MembershipModal, opened through `onJoin`. Same visual system as the homepage
 * (Inter, brand blue, ink/paper surfaces).
 *
 * Deliberately plain and short: hierarchy comes from type, spacing and
 * hairlines, not from badges, icon tiles or glows. Only the hero's primary
 * button carries the animated .btn-member treatment. Titles come from
 * t.membership; the one-line descriptions below are condensed versions of the
 * longer i18n copy, kept here because only this page uses them.
 */

type Impact = { members: number; raised: number; goal: number };

type Props = {
    onJoin: () => void;
    impact: Impact;
    /** Rendered above the hero headline (e.g. the overdue-quota notice). */
    notice?: ReactNode;
};

const COPY = {
    pt: {
        heroLead: "Mais do que uma subscrição, um compromisso espiritual.",
        cardLabel: "Cartão de membro",
        memberWord: "Membro",
        benefitsTitle: "Benefícios de ser membro",
        rezarBenefit: "Catecismo inteligente e exame de consciência na app Garabandal+.",
        rezarIncluded: "Rezar+ incluído",
        benefits: {
            archive: "Documentos, testemunhos e registos históricos reservados aos membros.",
            videos: "Documentários e estudos sobre as Aparições.",
            discount: "Em toda a livraria oficial.",
            voucher: "Numa das peregrinações anuais.",
            altar: "As suas orações levadas ao local das Aparições.",
            masses: "Celebradas pelas intenções dos membros.",
            community: "Voto e voz nas decisões da associação.",
            conferences: "Nos eventos e conferências anuais.",
        },
        rezar: {
            kicker: "Incluído na quota",
            title: "Rezar+ na app Garabandal+",
            lead: "Uma das apps católicas mais completas do mundo. Como membro, tem o Rezar+ incluído.",
            catechismTitle: "Catecismo inteligente",
            catechismDesc: "Pergunte e receba respostas com as fontes do Catecismo.",
            confessionTitle: "Exame de consciência",
            confessionDesc: "Prepare a confissão com um exame guiado.",
            link: "Conhecer a app",
            catechismAlt: "Garabandal+: pergunte ao Catecismo",
            confessionAlt: "Garabandal+: prepare a sua confissão",
        },
        mission: "Desde 2007 a divulgar em língua portuguesa as aparições de Nossa Senhora do Carmo de Garabandal.",
        impactLead: "Cada quota sustenta encontros, livros e o acolhimento aos peregrinos.",
        impactNote: "Cobre as despesas fixas da associação, sem fins lucrativos.",
        finalTitle: "Faça parte do Apostolado.",
        payments: "Cartão, MB WAY, PIX ou Multibanco. Renovação manual.",
    },
    en: {
        heroLead: "More than a subscription, a spiritual commitment.",
        cardLabel: "Member card",
        memberWord: "Member",
        benefitsTitle: "Member benefits",
        rezarBenefit: "Smart Catechism and examination of conscience in the Garabandal+ app.",
        rezarIncluded: "Rezar+ included",
        benefits: {
            archive: "Documents, testimonies and historical records reserved for members.",
            videos: "Documentaries and studies on the Apparitions.",
            discount: "Across the official bookshop.",
            voucher: "On one of the yearly pilgrimages.",
            altar: "Your prayers taken to the site of the Apparitions.",
            masses: "Celebrated for members' intentions.",
            community: "A vote and a voice in the association.",
            conferences: "On yearly events and conferences.",
        },
        rezar: {
            kicker: "Included with membership",
            title: "Rezar+ in the Garabandal+ app",
            lead: "One of the most complete Catholic apps in the world. As a member, Rezar+ is included.",
            catechismTitle: "Smart Catechism",
            catechismDesc: "Ask and get answers with sources from the Catechism.",
            confessionTitle: "Examination of conscience",
            confessionDesc: "Prepare for confession with a guided examination.",
            link: "Discover the app",
            catechismAlt: "Garabandal+: ask the Catechism",
            confessionAlt: "Garabandal+: prepare your confession",
        },
        mission: "Since 2007, sharing the apparitions of Our Lady of Mount Carmel of Garabandal in Portuguese.",
        impactLead: "Every membership sustains gatherings, books and care for pilgrims.",
        impactNote: "It covers the association's fixed costs, on a non-profit basis.",
        finalTitle: "Become part of the Apostolate.",
        payments: "Card, MB WAY, PIX or Multibanco. Manual renewal.",
    },
} as const;

function useCopy() {
    const { locale } = useLocale();
    return COPY[locale === "en" ? "en" : "pt"];
}

/* -------------------------------------------------------------------------- */
/*                                 Primitives                                 */
/* -------------------------------------------------------------------------- */

const SOLID_BUTTON =
    "inline-flex min-h-13 items-center justify-center rounded-full bg-brand px-7 py-3.5 text-base font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const TEXT_LINK =
    "text-[15px] font-semibold underline decoration-2 underline-offset-[6px] transition-colors";

function Kicker({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
    return <p className={`mb-4 text-[15px] font-medium ${onDark ? "text-[#8aa8ff]" : "text-brand"}`}>{children}</p>;
}

/** The membership as an object: brand-blue card with the Garabandal+ mark. */
function MemberCard({ className = "", priority = false }: { className?: string; priority?: boolean }) {
    const c = useCopy();
    return (
        <div
            aria-hidden
            className={`relative isolate aspect-[1.586] w-full overflow-hidden rounded-[1.25rem] text-white shadow-[0_40px_80px_-30px_rgba(31,85,214,0.55),0_12px_24px_-12px_rgba(15,27,51,0.35)] ${className}`}
            style={{ background: "linear-gradient(140deg, #4a84f6 0%, #2259db 48%, #10307f 100%)" }}
        >
            {/* Our Lady line art from the app icon, blended into the card */}
            <Image
                src="/images/app-icon-512.png"
                alt=""
                width={512}
                height={512}
                priority={priority}
                className="pointer-events-none absolute -right-[12%] top-1/2 -z-10 h-[125%] w-auto -translate-y-1/2 opacity-90 mix-blend-screen"
                style={{
                    maskImage: "radial-gradient(closest-side, black 62%, transparent 100%)",
                    WebkitMaskImage: "radial-gradient(closest-side, black 62%, transparent 100%)",
                }}
            />
            {/* Fine top edge highlight */}
            <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] ring-1 ring-inset ring-white/20" />

            <div className="flex h-full flex-col justify-between p-[7%]">
                <div>
                    <p className="text-[clamp(0.8rem,0.6rem+0.6vw,1rem)] font-semibold tracking-[-0.01em]">Apostolado de Garabandal</p>
                    <p className="mt-0.5 text-[clamp(0.65rem,0.55rem+0.3vw,0.75rem)] text-white/70">{c.cardLabel}</p>
                </div>

                <div>
                    <p className="text-[clamp(1.1rem,0.85rem+0.9vw,1.5rem)] font-semibold tracking-[-0.02em]">{c.memberWord}</p>
                    <p className="mt-1 text-[clamp(0.65rem,0.55rem+0.3vw,0.75rem)] text-white/75">{c.rezarIncluded}</p>
                </div>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*                                    Hero                                    */
/* -------------------------------------------------------------------------- */

function Hero({ onJoin, notice }: Pick<Props, "onJoin" | "notice">) {
    const { t } = useLocale();
    const { formatPrice } = useCurrency();
    const c = useCopy();
    const m = t.membership;

    return (
        <section className="overflow-hidden bg-white">
            <div className={`${CONTAINER} pb-20 pt-14 md:pb-28 lg:pt-44`}>
                {notice && <div className="mb-10 empty:hidden">{notice}</div>}

                <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
                    <div>
                        <h1 className="text-[clamp(2.6rem,1.6rem+3.6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
                            {m.hero.title}
                            <br />
                            <span className="whitespace-nowrap text-brand">{m.hero.titleHighlight}</span>
                        </h1>

                        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted md:text-xl">{c.heroLead}</p>

                        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-5">
                            <button
                                type="button"
                                onClick={onJoin}
                                className="btn-member group min-h-14 gap-3 rounded-full px-8 text-base font-semibold tracking-[-0.01em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            >
                                <span>{m.hero.cta}</span>
                                <ArrowRight size={18} aria-hidden className="shrink-0 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
                            </button>
                            <p className="leading-tight">
                                <span className="text-2xl font-semibold tracking-[-0.03em] text-ink">{formatPrice(getMembershipAmountClient())}</span>
                                <span className="ml-1 text-muted">{m.hero.perYear}</span>
                                <span className="mt-1 block text-sm text-muted">{m.hero.immediateAccess}</span>
                            </p>
                        </div>
                    </div>

                    <div className="mx-auto w-full max-w-[520px] lg:mr-0">
                        <MemberCard priority className="-rotate-[4deg]" />
                    </div>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*                                  Benefits                                  */
/* -------------------------------------------------------------------------- */

function Benefits() {
    const { t } = useLocale();
    const c = useCopy();
    const b = t.membership.benefits;

    const items = [
        { icon: ScrollText, title: b.archive, desc: c.benefits.archive },
        { icon: PlayCircle, title: b.videos, desc: c.benefits.videos },
        { icon: Smartphone, title: c.rezarIncluded, desc: c.rezarBenefit },
        { icon: MapPin, title: b.voucher, desc: c.benefits.voucher },
        { icon: BookOpen, title: b.discount, desc: c.benefits.discount },
        { icon: Flame, title: b.altar, desc: c.benefits.altar },
        { icon: Church, title: b.masses, desc: c.benefits.masses },
        { icon: Mic2, title: b.conferences, desc: c.benefits.conferences },
        { icon: Users, title: b.community, desc: c.benefits.community },
    ];

    return (
        <section id="beneficios" aria-labelledby="beneficios-title" className="scroll-mt-24 bg-white py-20 md:py-28">
            <div className={CONTAINER}>
                <div className="max-w-xl">
                    <Kicker>{b.eyebrow}</Kicker>
                    <h2 id="beneficios-title" className={`${H2_CLASS} text-ink`}>{c.benefitsTitle}</h2>
                </div>

                <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
                    {items.map(({ icon: Icon, title, desc }) => (
                        <li key={title} className="flex flex-col bg-white p-7 md:p-8">
                            {/* Glowing icon: soft brand halo behind a brand-blue glyph */}
                            <span className="relative mb-6 flex h-12 w-12 items-center justify-center">
                                <span aria-hidden className="absolute inset-1 rounded-full bg-brand/40 blur-lg" />
                                <Icon size={26} strokeWidth={1.9} aria-hidden className="relative text-brand drop-shadow-[0_0_10px_rgba(53,99,233,0.85)]" />
                            </span>
                            <h3 className="text-lg font-semibold leading-snug tracking-[-0.015em] text-ink">{title}</h3>
                            <p className="mt-2 text-[15px] leading-relaxed text-muted">{desc}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*                                   Rezar+                                   */
/* -------------------------------------------------------------------------- */

function RezarPlus() {
    const c = useCopy().rezar;

    const features = [
        { title: c.catechismTitle, desc: c.catechismDesc },
        { title: c.confessionTitle, desc: c.confessionDesc },
    ];

    return (
        <section aria-labelledby="rezar-title" className="overflow-hidden bg-ink py-20 text-white md:py-28">
            <div className={CONTAINER}>
                <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
                    <div>
                        <Kicker onDark>{c.kicker}</Kicker>
                        <h2 id="rezar-title" className={H2_CLASS}>{c.title}</h2>
                        <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">{c.lead}</p>

                        <dl className="mt-10 border-t border-white/10">
                            {features.map((f) => (
                                <div key={f.title} className="border-b border-white/10 py-5">
                                    <dt className="text-lg font-semibold tracking-[-0.015em]">{f.title}</dt>
                                    <dd className="mt-1 text-[15px] text-white/65">{f.desc}</dd>
                                </div>
                            ))}
                        </dl>

                        <Link href="/app" className={`${TEXT_LINK} mt-9 inline-flex text-white decoration-white/30 hover:decoration-white`}>
                            {c.link}
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:gap-6">
                        <div className="relative aspect-[853/1844] overflow-hidden rounded-[1.5rem]">
                            <Image src="/images/app/screen-catechism.webp" alt={c.catechismAlt} fill sizes="(max-width: 1024px) 45vw, 300px" className="object-cover" />
                        </div>
                        <div className="relative mt-16 aspect-[853/1844] overflow-hidden rounded-[1.5rem]">
                            <Image src="/images/app/screen-confession.webp" alt={c.confessionAlt} fill sizes="(max-width: 1024px) 45vw, 300px" className="object-cover" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*                                   Mission                                  */
/* -------------------------------------------------------------------------- */

function Mission() {
    const { t } = useLocale();
    const c = useCopy();
    const a = t.membership.about;

    return (
        <section aria-labelledby="missao-title" className="bg-paper py-20 md:py-28">
            <div className={CONTAINER}>
                <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
                        <Image
                            src="/images/nossasenhoragarabandal.jpg"
                            alt={a.imageAlt}
                            fill
                            sizes="(max-width: 1024px) 100vw, 560px"
                            className="object-cover"
                        />
                    </div>

                    <div>
                        <Kicker>{a.eyebrow}</Kicker>
                        <h2 id="missao-title" className={`${H2_CLASS} text-ink`}>
                            {a.titleLead} <span className="text-brand">{a.titleYears}</span> {a.titleTrail}
                        </h2>
                        <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">{c.mission}</p>

                        <ul className="mt-8 border-t border-line">
                            {a.bullets.map((item) => (
                                <li key={item} className="border-b border-line py-4 text-[16px] font-medium text-ink">{item}</li>
                            ))}
                        </ul>

                        <Link href={t.urls.about} className={`${TEXT_LINK} mt-9 inline-flex text-ink decoration-line hover:decoration-brand`}>
                            {a.cta}
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*                                   Impact                                   */
/* -------------------------------------------------------------------------- */

function ImpactBlock({ impact }: { impact: Impact }) {
    const { t, locale } = useLocale();
    const c = useCopy();
    const i = t.membership.impact;
    const numberLocale = locale === "en" ? "en-GB" : "pt-PT";
    const progress = Math.min(100, Math.max(0, (impact.raised / impact.goal) * 100));

    return (
        <section aria-labelledby="impacto-title" className="bg-paper py-20 md:py-28">
            <div className={CONTAINER}>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
                    <div>
                        <h2 id="impacto-title" className={`${H2_CLASS} text-ink`}>
                            {i.titleLead} <span className="text-brand">{i.titleHighlight}</span>
                        </h2>
                        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">{c.impactLead}</p>
                    </div>

                    <div className="rounded-2xl border border-line bg-white p-7 md:p-10">
                        <div className="flex items-baseline justify-between gap-6">
                            <p className="text-sm text-muted">{i.goalLabel}</p>
                            <p className="text-sm font-semibold tabular-nums text-brand">{progress.toFixed(0)}%</p>
                        </div>
                        <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ink md:text-4xl">
                            €{impact.raised.toLocaleString(numberLocale)}
                            <span className="ml-2 text-lg font-normal tracking-normal text-muted">/ €{impact.goal.toLocaleString(numberLocale)}</span>
                        </p>
                        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-brand-50">
                            <div style={{ width: `${progress}%` }} className="h-full rounded-full bg-brand" />
                        </div>

                        <div className="mt-8 flex items-baseline gap-3 border-t border-line pt-6">
                            <p className="text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ink">{impact.members}</p>
                            <p className="text-muted">{i.activeMembers.toLowerCase()}</p>
                        </div>
                        <p className="mt-3 text-sm text-muted">{c.impactNote}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*                                     FAQ                                    */
/* -------------------------------------------------------------------------- */

function Faq() {
    const { t } = useLocale();
    const f = t.membership.faq;
    const [open, setOpen] = useState<number | null>(null);

    return (
        <section aria-labelledby="faq-title" className="bg-white py-20 md:py-28">
            <div className={CONTAINER}>
                <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
                    <h2 id="faq-title" className={`${H2_CLASS} text-ink`}>{f.title}</h2>

                    <div className="border-t border-line">
                        {f.items.map((item, idx) => {
                            const isOpen = open === idx;
                            return (
                                <div key={idx} className="border-b border-line">
                                    <button
                                        type="button"
                                        onClick={() => setOpen(isOpen ? null : idx)}
                                        aria-expanded={isOpen}
                                        aria-controls={`membership-faq-${idx}`}
                                        className="flex w-full items-center justify-between gap-6 py-6 text-left"
                                    >
                                        <span className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{item.q}</span>
                                        <Plus
                                            size={18}
                                            aria-hidden
                                            className={`shrink-0 text-muted transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                                        />
                                    </button>
                                    <div
                                        id={`membership-faq-${idx}`}
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="pb-6 pr-10 text-[15px] leading-relaxed text-muted">{item.a}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*                                  Final CTA                                 */
/* -------------------------------------------------------------------------- */

function FinalCta({ onJoin }: { onJoin: () => void }) {
    const { t } = useLocale();
    const { formatPrice } = useCurrency();
    const c = useCopy();
    const m = t.membership;

    return (
        <section className="overflow-hidden border-t border-line bg-paper py-20 md:py-24">
            <div className={CONTAINER}>
                <div className="grid items-center gap-12 md:grid-cols-[1.2fr_0.8fr]">
                    <div>
                        <h2 className={`${H2_CLASS} text-ink`}>{c.finalTitle}</h2>
                        <div className="mt-8 flex flex-wrap items-center gap-6">
                            <button type="button" onClick={onJoin} className={SOLID_BUTTON}>
                                {m.hero.cta}
                            </button>
                            <p className="text-muted">
                                <span className="text-xl font-semibold text-ink">{formatPrice(getMembershipAmountClient())}</span> {m.hero.perYear}
                            </p>
                        </div>
                        <p className="mt-5 text-sm text-muted">{c.payments}</p>
                    </div>
                    <MemberCard className="mx-auto hidden max-w-[360px] rotate-[3deg] md:block" />
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */

export default function MembershipLanding({ onJoin, impact, notice }: Props) {
    return (
        <>
            <Hero onJoin={onJoin} notice={notice} />
            <Mission />
            <Benefits />
            <RezarPlus />
            <ImpactBlock impact={impact} />
            <Faq />
            <FinalCta onJoin={onJoin} />
        </>
    );
}
