"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import RichText from '../RichText';
import { isRichTextEmpty } from '../../../lib/rich-text';
import { MaskText, Reveal } from './primitives';
import { EASE_CINE, EASE_OUT } from './motion';
import type { CinemaTeamMember } from './types';

const COUNTRY_NAMES: Record<string, { pt: string; en: string }> = {
    PT: { pt: 'Portugal', en: 'Portugal' },
    BR: { pt: 'Brasil', en: 'Brazil' },
    ES: { pt: 'Espanha', en: 'Spain' },
    FR: { pt: 'França', en: 'France' },
    IT: { pt: 'Itália', en: 'Italy' },
    US: { pt: 'EUA', en: 'USA' },
};

function countryLabel(country: string | undefined, isEn: boolean) {
    const raw = (country || '').trim();
    if (!raw) return '';
    const known = raw.length === 2 ? COUNTRY_NAMES[raw.toUpperCase()] : undefined;
    if (known) return isEn ? known.en : known.pt;
    // "PORTUGAL" → "Portugal" (o admin guarda muitas vezes em maiúsculas).
    return raw === raw.toUpperCase() ? raw.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()) : raw;
}

type Person = {
    key: string;
    name: string;
    role: string;
    country: string;
    image: string;
    bio: string;
    guest: boolean;
};

function toPeople(members: CinemaTeamMember[], isEn: boolean): Person[] {
    return members.map((m, i) => {
        const bio = isEn ? m.description_en || m.description : m.description;
        return {
            key: m.id || String(i),
            name: m.name,
            role: (isEn ? m.role_en || m.role : m.role) || '',
            country: countryLabel(m.country, isEn),
            image: m.image_url,
            bio: isRichTextEmpty(bio) ? '' : bio,
            guest: !!m.is_special_guest,
        };
    });
}

function useIsDesktop() {
    const [desktop, setDesktop] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const sync = () => setDesktop(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);
    return desktop;
}

function RoleLine({ person, isEn }: { person: Person; isEn: boolean }) {
    return (
        <p className="pg-team-role">
            <span>{person.role}</span>
            {person.country && <span className="pg-team-role-muted">{person.country}</span>}
            {person.guest && <span className="pg-team-guest">{isEn ? 'Guest' : 'Convidado'}</span>}
        </p>
    );
}

/** Bio com "Ler mais" só quando passa do limite. */
function Bio({ html, isEn, lines }: { html: string; isEn: boolean; lines: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || expanded) return;
        setOverflowing(el.scrollHeight > el.clientHeight + 2);
    }, [html, expanded]);
    if (!html) return null;
    return (
        <>
            <div ref={ref} className={`pg-team-bio ${expanded ? '' : 'is-clamped'}`} style={{ ['--lines' as string]: lines }}>
                <RichText value={html} className="text-[16px] leading-[1.7] text-[var(--pg-ink-muted)]" />
            </div>
            {(overflowing || expanded) && (
                <button type="button" className="pg-link pg-meta" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                    {expanded ? (isEn ? 'Show less' : 'Ler menos') : (isEn ? 'Read more' : 'Ler mais')}
                </button>
            )}
        </>
    );
}

/** Desktop: lista de nomes + retrato grande que troca com uma cortina. */
function Roster({ people, isEn }: { people: Person[]; isEn: boolean }) {
    const reduce = useReducedMotion();
    const [active, setActive] = useState(0);
    const person = people[active];
    return (
        <div className="pg-roster">
            <div className="pg-roster-left">
                <ul className="pg-roster-list" role="tablist" aria-label={isEn ? 'Team members' : 'Membros da equipa'}>
                    {people.map((p, i) => (
                        <li key={p.key}>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={i === active}
                                className={`pg-roster-item ${i === active ? 'is-active' : ''}`}
                                onMouseEnter={() => setActive(i)}
                                onFocus={() => setActive(i)}
                                onClick={() => setActive(i)}
                            >
                                <span className="pg-roster-num">{String(i + 1).padStart(2, '0')}</span>
                                <span className="pg-roster-text">
                                    <span className="pg-display pg-roster-name">{p.name}</span>
                                    <span className="pg-roster-sub">{p.role}</span>
                                </span>
                                {i === active && !reduce && (
                                    <motion.span layoutId="pg-roster-line" className="pg-roster-line" transition={{ duration: 0.5, ease: EASE_OUT }} />
                                )}
                            </button>
                        </li>
                    ))}
                </ul>

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={person.key}
                        className="pg-roster-bio"
                        role="tabpanel"
                        initial={reduce ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                    >
                        <RoleLine person={person} isEn={isEn} />
                        <Bio html={person.bio} isEn={isEn} lines={7} />
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="pg-roster-portrait">
                <AnimatePresence initial={false}>
                    <motion.div
                        key={person.key}
                        className="pg-roster-frame"
                        initial={reduce ? false : { clipPath: 'inset(0% 0% 0% 100%)' }}
                        animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                        exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.35 } }}
                        transition={{ duration: 0.85, ease: EASE_CINE }}
                    >
                        {person.image ? (
                            <motion.img
                                src={person.image}
                                alt={person.name}
                                loading="lazy"
                                decoding="async"
                                initial={reduce ? false : { scale: 1.12 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 1.4, ease: EASE_OUT }}
                            />
                        ) : (
                            <span className="pg-member-initial pg-display" aria-hidden>{person.name.slice(0, 1)}</span>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

/** Mobile: carrossel horizontal com snap, cartões compactos. */
function Carousel({ people, isEn }: { people: Person[]; isEn: boolean }) {
    const trackRef = useRef<HTMLUListElement>(null);
    const [index, setIndex] = useState(0);

    const onScroll = () => {
        const el = trackRef.current;
        if (!el) return;
        const card = el.querySelector<HTMLElement>('.pg-team-card');
        if (!card) return;
        const step = card.offsetWidth + 12;
        setIndex(Math.min(people.length - 1, Math.max(0, Math.round(el.scrollLeft / step))));
    };

    const goTo = (i: number) => {
        const el = trackRef.current;
        const card = el?.querySelectorAll<HTMLElement>('.pg-team-card')[i];
        if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: 'smooth' });
    };

    return (
        <div className="pg-team-carousel">
            <ul ref={trackRef} className="pg-team-track" onScroll={onScroll}>
                {people.map((p) => (
                    <li key={p.key} className="pg-team-card">
                        <div className="pg-team-card-photo">
                            {p.image ? (
                                <img src={p.image} alt={p.name} loading="lazy" decoding="async" />
                            ) : (
                                <span className="pg-member-initial pg-display" aria-hidden>{p.name.slice(0, 1)}</span>
                            )}
                        </div>
                        <h3 className="pg-display pg-team-card-name">{p.name}</h3>
                        <RoleLine person={p} isEn={isEn} />
                        <Bio html={p.bio} isEn={isEn} lines={4} />
                    </li>
                ))}
            </ul>
            {people.length > 1 && (
                <div className="pg-team-dots" role="tablist" aria-label={isEn ? 'Team members' : 'Membros da equipa'}>
                    {people.map((p, i) => (
                        <button
                            key={p.key}
                            type="button"
                            role="tab"
                            aria-selected={i === index}
                            aria-label={p.name}
                            className={`pg-team-dot ${i === index ? 'is-active' : ''}`}
                            onClick={() => goTo(i)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TeamSection({ members, isEn }: { members: CinemaTeamMember[]; isEn: boolean }) {
    const desktop = useIsDesktop();
    if (!members || members.length === 0) return null;
    const people = toPeople(members, isEn);
    return (
        <section id="team" className="pg-team pg-stone" aria-labelledby="pg-team-heading">
            <div className="pg-wrap pg-wrap-docked">
                <Reveal>
                    <p className="pg-meta pg-eyebrow text-[var(--pg-ink-muted)]">{isEn ? 'The team' : 'A equipa'}</p>
                </Reveal>
                <h2 id="pg-team-heading" className="pg-display pg-section-title">
                    <MaskText text={isEn ? 'Who walks with the group.' : 'Quem acompanha o grupo.'} />
                </h2>
                <Reveal delay={0.1}>
                    {desktop ? <Roster people={people} isEn={isEn} /> : <Carousel people={people} isEn={isEn} />}
                </Reveal>
            </div>
        </section>
    );
}
