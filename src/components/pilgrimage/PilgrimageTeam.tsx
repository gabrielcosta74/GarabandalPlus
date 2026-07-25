'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import RichText from './RichText';
import { isRichTextEmpty } from '../../lib/rich-text';

interface TeamMember {
    id?: string;
    name: string;
    role: string;
    role_en?: string | null;
    country: string;
    image_url: string;
    is_special_guest: boolean;
    description: string;
    description_en?: string | null;
}

const NAME_TO_CODE: Record<string, string> = {
    PORTUGAL: 'PT', BRASIL: 'BR', BRAZIL: 'BR', ESPANHA: 'ES', ESPAÑA: 'ES', SPAIN: 'ES',
    FRANCA: 'FR', FRANÇA: 'FR', FRANCE: 'FR', ITALIA: 'IT', ITÁLIA: 'IT', ITALY: 'IT',
    ALEMANHA: 'DE', GERMANY: 'DE', EUA: 'US', USA: 'US', REINOUNIDO: 'GB', 'UK': 'GB',
    MEXICO: 'MX', MÉXICO: 'MX', COLOMBIA: 'CO', ARGENTINA: 'AR', POLONIA: 'PL', POLÓNIA: 'PL',
};

/** Convert an ISO-2 code or a country name into a flag emoji, when possible. */
function countryFlag(country?: string): string | null {
    const raw = (country || '').trim();
    if (!raw) return null;
    const code = raw.length === 2 ? raw.toUpperCase() : NAME_TO_CODE[raw.toUpperCase().replace(/\s+/g, '')];
    if (!code || !/^[A-Z]{2}$/.test(code)) return null;
    return String.fromCodePoint(...[...code].map((ch) => 127397 + ch.charCodeAt(0)));
}

function MemberCard({ member, isEn }: { member: TeamMember; isEn: boolean }) {
    const role = isEn ? member.role_en || member.role : member.role;
    const bio = isEn ? member.description_en || member.description : member.description;
    const flag = countryFlag(member.country);
    const hasBio = !isRichTextEmpty(bio);

    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);
    const bioRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const el = bioRef.current;
        if (!el || expanded) return;
        setOverflowing(el.scrollHeight - el.clientHeight > 6);
    }, [bio, expanded]);

    return (
        <figure className="group flex flex-col">
            {/* Portrait */}
            <div
                className={`relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-slate-100 shadow-sm transition-all duration-500 group-hover:shadow-xl ${member.is_special_guest ? 'ring-2 ring-yellow-300' : 'ring-1 ring-slate-200/70'
                    }`}
            >
                {member.image_url ? (
                    <img
                        src={member.image_url}
                        alt={member.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-300">
                        <Users className="h-12 w-12" />
                    </div>
                )}

                {member.is_special_guest && (
                    <span className="absolute left-3 top-3 rounded-full bg-yellow-400/95 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-yellow-950 shadow-sm backdrop-blur-sm">
                        {isEn ? 'Guest' : 'Convidado'}
                    </span>
                )}
            </div>

            {/* Caption */}
            <figcaption className="pt-4">
                <h3 className="font-serif text-lg font-bold leading-tight text-slate-900">{member.name}</h3>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-yellow-700">
                    <span>{role}</span>
                    {flag && (
                        <>
                            <span className="text-slate-300">·</span>
                            <span className="text-base leading-none" aria-hidden>{flag}</span>
                        </>
                    )}
                </p>

                {hasBio && (
                    <div className="mt-3">
                        <div
                            ref={bioRef}
                            className="relative overflow-hidden transition-[max-height] duration-300 ease-out"
                            style={{ maxHeight: expanded ? '60rem' : '6.75rem' }}
                        >
                            <RichText value={bio} className="text-[15px] leading-relaxed text-slate-600" />
                            {!expanded && overflowing && (
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
                            )}
                        </div>
                        {overflowing && (
                            <button
                                type="button"
                                onClick={() => setExpanded((v) => !v)}
                                className="mt-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-yellow-700"
                            >
                                {expanded ? (isEn ? 'Show less' : 'Ver menos') : (isEn ? 'Read more' : 'Ver mais')}
                            </button>
                        )}
                    </div>
                )}
            </figcaption>
        </figure>
    );
}

export default function PilgrimageTeam({ members, isEn }: { members: TeamMember[]; isEn: boolean }) {
    if (!members || members.length === 0) return null;

    return (
        <section>
            <div className="mb-7 px-5 md:px-0">
                <span className="text-xs font-black uppercase tracking-widest text-yellow-700">
                    {isEn ? 'Who guides you' : 'Quem te acompanha'}
                </span>
                <h2 className="mt-1 flex items-center gap-2.5 font-serif text-2xl font-bold text-slate-900 md:text-3xl">
                    <Users className="h-6 w-6 text-yellow-600" />
                    {isEn ? 'Pilgrimage Team' : 'Equipa da Peregrinação'}
                </h2>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-9 px-5 sm:grid-cols-2 md:px-0 lg:grid-cols-3 md:gap-x-8 md:gap-y-10">
                {members.map((member, idx) => (
                    <MemberCard key={member.id || idx} member={member} isEn={isEn} />
                ))}
            </div>
        </section>
    );
}
